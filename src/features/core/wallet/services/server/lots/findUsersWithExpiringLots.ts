// src/features/core/wallet/services/server/lots/findUsersWithExpiringLots.ts
// 失効間近ロットを持つユーザーの抽出（失効予告の通知バッチ用データレイヤ）
//
// UI・通知の文言/送信はダウンストリーム所有。ここは対象抽出のみ。
//
// - 窓は絶対時刻（expiresFrom / expiresTo）で受け取る。NOW() 起点の相対日数にすると
//   ページをまたぐたびに窓がずれ、境界のユーザーが欠落・重複するため。
//   呼び出し側は1回の実行の最初に窓を確定し、全ページで同じ値を渡すこと
// - userId の keyset ページング（OFFSET 不使用）。runBudgetedBatches の fetchNext に載せられる
// - 1ページごとに窓内のロット数ぶんの走査コストがかかる（wallet_lots_expires_idx の範囲スキャン
//   → ユーザー集計）。窓は狭く（1日幅など）取ること

import { and, eq, gt, gte, lt, min, sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";
import { WalletTable, WalletLotTable } from "@/features/core/wallet/entities/drizzle";
import { isExpirationEnabled } from "@/features/core/wallet/utils/expiration";
import type {
  FindUsersWithExpiringLotsParams,
  FindUsersWithExpiringLotsResult,
} from "@/features/core/wallet/services/types";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new DomainError(`${label} は有効な Date で指定してください。`, { status: 400 });
  }
}

/**
 * 指定窓内に失効するロットを持つユーザーを userId 昇順でページング取得する。
 *
 * - 対象: remaining > 0 かつ expiresFrom <= expires_at < expiresTo のロット
 * - 期限切れ済み（未スイープ）のロットは「もう失効した扱い」のため含めない
 * - 有効期限が無効な walletType では常に空を返す（sweepEnabled: false の告知期間モードでは動作する）
 */
export async function findUsersWithExpiringLots(
  params: FindUsersWithExpiringLotsParams,
): Promise<FindUsersWithExpiringLotsResult> {
  const { walletType, expiresFrom, expiresTo, cursor } = params;
  assertDate(expiresFrom, "expiresFrom");
  assertDate(expiresTo, "expiresTo");
  if (cursor && !UUID_PATTERN.test(cursor)) {
    throw new DomainError("cursor の形式が不正です。", { status: 400 });
  }

  if (!isExpirationEnabled(walletType) || expiresTo.getTime() <= expiresFrom.getTime()) {
    return { items: [], nextCursor: null };
  }

  const limit = Math.min(Math.max(1, Math.floor(params.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);

  const conditions = [
    eq(WalletTable.type, walletType),
    gt(WalletLotTable.remaining, 0),
    gte(WalletLotTable.expires_at, expiresFrom),
    lt(WalletLotTable.expires_at, expiresTo),
    sql`${WalletLotTable.expires_at} >= NOW()`,
  ];
  if (cursor) {
    conditions.push(gt(WalletTable.user_id, cursor));
  }

  // 次ページ有無の判定用に1件多く取得する
  const rows = await db
    .select({
      userId: WalletTable.user_id,
      totalExpiring: sql<number>`SUM(${WalletLotTable.remaining})::int`,
      earliestExpiresAt: min(WalletLotTable.expires_at),
    })
    .from(WalletLotTable)
    .innerJoin(WalletTable, eq(WalletLotTable.wallet_id, WalletTable.id))
    .where(and(...conditions))
    .groupBy(WalletTable.user_id)
    .orderBy(WalletTable.user_id)
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const items = page.map((row) => ({
    userId: row.userId,
    totalExpiring: Number(row.totalExpiring),
    // GROUP BY の各グループは必ず1行以上を持つため MIN は null にならない
    earliestExpiresAt: row.earliestExpiresAt!,
  }));

  return {
    items,
    nextCursor: rows.length > limit ? page[page.length - 1]!.userId : null,
  };
}
