// src/features/core/wallet/services/server/wrappers/bulkGrant.ts
//
// 一括付与と補填(README「一括付与と補填」): 複数のユーザーに同じ額か人ごとの額を付ける。
// - 全員を 1 つの transaction で bulkAdjustByUsers に通す(額ごとにまとめる、INCREMENT だけ、source admin_action、1 つの request_batch_id)。
//   1 人でも書けなければ全部戻す(半端に残らない)
// - 種類(kind): grant = 付与の種類 admin_adjustment、compensation = compensation(お詫び・補填)。区分はどちらも admin_adjustment
//   (発行には数えない。AMENDMENT 1 = c)、reason_key で見分ける
// - 飛ばす(書かない): 知らない id・削除済みのユーザー。先に止める: 額が正の整数でない・重なり・空・上限 MAX_BULK_GRANT_USERS 超え・知らない通貨・理由なし
// - notify: commit の後に 1 人ずつ sendAdjustmentNotification(お知らせの機能が閉じていれば送らない。失敗は付与を戻さず notifyFailed に並べる)
// - 取り消し: walletService.reverseHistory({ requestBatchId })(pnpm task wallet:reverse-history -- --batch <requestBatchId>)
// 呼び手: 運用コマンド pnpm task wallet:bulk-grant。後で管理画面からも同じ関数を呼ぶ(L1.34)

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { VALID_WALLET_TYPES } from "@/features/core/wallet/utils/currency";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";

import { bulkAdjustByUsers } from "./bulkAdjustByUsers";
import { runWithTransaction } from "./utils";

/** 1 回の上限(1 つの transaction で財布を行ロックするため。超えるならファイルを分ける) */
export const MAX_BULK_GRANT_USERS = 10_000;

export const BULK_GRANT_KINDS = { grant: "admin_adjustment", compensation: "compensation" } as const;
export type BulkGrantKind = keyof typeof BULK_GRANT_KINDS;

export type BulkGrantParams = {
  walletType: WalletTypeValue;
  grants: Array<{ userId: string; amount: number }>;
  kind: BulkGrantKind;
  /** 履歴の reason と監査に残る理由(必須) */
  reason: string;
  /** commit の後に 1 人ずつお知らせを送る */
  notify?: boolean;
  dryRun?: boolean;
};

export type BulkGrantResult = {
  dryRun: boolean;
  /** 付けた行の request_batch_id(取り消しの --batch に渡す。dryRun では null) */
  requestBatchId: string | null;
  granted: Array<{ userId: string; amount: number }>;
  skipped: Array<{ userId: string; why: string }>;
  total: number;
  /** お知らせの処理を通った人数(お知らせの機能が閉じていれば送らずに数える) */
  notified: number;
  notifyFailed: Array<{ userId: string; error: string }>;
};

const CHUNK = 500;

function assertParams(params: BulkGrantParams): void {
  if (!(VALID_WALLET_TYPES as readonly string[]).includes(params.walletType)) {
    throw new DomainError(`知らない通貨です: ${params.walletType}(${VALID_WALLET_TYPES.join(" / ")})`, { status: 400 });
  }
  if (!(params.kind in BULK_GRANT_KINDS)) throw new DomainError(`知らない種類です: ${params.kind}(grant / compensation)`, { status: 400 });
  if (!params.reason?.trim()) throw new DomainError("付与の理由(reason)を指定してください。", { status: 400 });
  if (!Array.isArray(params.grants) || params.grants.length === 0) throw new DomainError("付けるユーザーがいません。", { status: 400 });
  if (params.grants.length > MAX_BULK_GRANT_USERS) {
    throw new DomainError(`1 回に付けられるのは ${MAX_BULK_GRANT_USERS} 人までです(${params.grants.length} 人。ファイルを分ける)`, { status: 400 });
  }
  const ids = params.grants.map((g) => g.userId);
  if (new Set(ids).size !== ids.length) throw new DomainError("同じユーザーが 2 回並んでいます。", { status: 400 });
  const bad = params.grants.filter((g) => !Number.isInteger(g.amount) || g.amount <= 0);
  if (bad.length > 0) throw new DomainError(`額は正の整数です: ${bad.slice(0, 5).map((g) => `${g.userId}=${g.amount}`).join(", ")}`, { status: 400 });
}

/** 付けられるユーザー(知らない・削除済みを飛ばす) */
async function splitByUser(params: BulkGrantParams): Promise<{ ok: BulkGrantParams["grants"]; skipped: BulkGrantResult["skipped"] }> {
  const ok: BulkGrantParams["grants"] = [];
  const skipped: BulkGrantResult["skipped"] = [];
  for (let at = 0; at < params.grants.length; at += CHUNK) {
    const part = params.grants.slice(at, at + CHUNK);
    const rows = await db
      .select({ id: UserTable.id, deletedAt: UserTable.deletedAt })
      .from(UserTable)
      .where(inArray(UserTable.id, part.map((g) => g.userId)));
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const grant of part) {
      const user = byId.get(grant.userId);
      if (!user) skipped.push({ userId: grant.userId, why: "知らない id" });
      else if (user.deletedAt) skipped.push({ userId: grant.userId, why: "削除済み" });
      else ok.push(grant);
    }
  }
  return { ok, skipped };
}

export async function bulkGrant(params: BulkGrantParams): Promise<BulkGrantResult> {
  assertParams(params);
  const dryRun = params.dryRun === true;
  const reason = params.reason.trim();
  const { ok, skipped } = await splitByUser(params);
  const total = ok.reduce((sum, g) => sum + g.amount, 0);
  const result: BulkGrantResult = { dryRun, requestBatchId: null, granted: ok, skipped, total, notified: 0, notifyFailed: [] };
  if (dryRun || ok.length === 0) return result;

  const requestBatchId = randomUUID();
  const reasonKey = BULK_GRANT_KINDS[params.kind];
  const byAmount = new Map<number, string[]>();
  for (const grant of ok) byAmount.set(grant.amount, [...(byAmount.get(grant.amount) ?? []), grant.userId]);

  await runWithTransaction(undefined, async (trx) => {
    for (const [amount, userIds] of byAmount) {
      for (let at = 0; at < userIds.length; at += CHUNK) {
        const chunk = userIds.slice(at, at + CHUNK);
        const res = await bulkAdjustByUsers(trx, chunk, {
          walletType: params.walletType,
          changeMethod: "INCREMENT",
          amount,
          sourceType: "admin_action",
          requestBatchId,
          reason,
          reasonKey,
          meta: { bulkGrantKind: params.kind },
        });
        const notDone = [...res.failed.map((f) => `${f.itemKey}: ${f.error}`), ...res.skipped.map((s) => `${s.itemKey}: ${s.reason}`)];
        if (notDone.length > 0) throw new DomainError(`付けられないユーザーがいるので、全部戻しました:\n${notDone.join("\n")}`, { status: 409 });
      }
    }
  });
  result.requestBatchId = requestBatchId;

  if (params.notify) {
    const { sendAdjustmentNotification } = await import("../notification/sendAdjustmentNotification");
    const rows = await db
      .select({ userId: WalletHistoryTable.user_id, before: WalletHistoryTable.balance_before, after: WalletHistoryTable.balance_after, delta: WalletHistoryTable.points_delta })
      .from(WalletHistoryTable)
      .where(and(eq(WalletHistoryTable.request_batch_id, requestBatchId), eq(WalletHistoryTable.type, params.walletType)));
    for (const row of rows) {
      try {
        await sendAdjustmentNotification({ userId: row.userId, walletType: params.walletType, changeMethod: "INCREMENT", amount: row.delta, balanceBefore: row.before, balanceAfter: row.after, reason });
        result.notified += 1;
      } catch (error) {
        result.notifyFailed.push({ userId: row.userId, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return result;
}
