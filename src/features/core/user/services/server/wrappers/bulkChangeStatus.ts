// src/features/core/user/services/server/wrappers/bulkChangeStatus.ts
//
// ユーザーのステータスの一括変更(README「ステータスの一括変更」)。1 人ずつ changeStatus と同じ道を通す
// (users の更新・遷移の履歴 recordStatusTransition・監査 user.status.changed を 1 人 1 transaction で、確定の後にセッション失効)。
// - 変えられる先: active / inactive / suspended / banned / security_locked。withdrawn(退会の流れ withdraw がある)と
//   pending(登録の途中)は先に止める
// - 飛ばす(その人には何も書かない): 知らない id・削除済み・既にその状態・onlyFrom を渡した時にその状態でない・管理者のカテゴリのロール
// - 1 人の失敗は他の人を戻さない(failed に並べる)。打ち直すと既に変わった人は飛ばすので、途中で落ちても同じ指定で打ち直せる
// - dryRun: 確かめと計画だけ(何も書かない)
// 呼び手: 運用コマンド pnpm task user:bulk-change-status。後で管理画面からも同じ関数を呼ぶ(L1.34)

import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import { getRoleCategory } from "@/features/core/user/utils/roleHelpers";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { base } from "../drizzleBase";
import { afterStatusChange, changeStatus } from "./changeStatus";

/** 一括で変えてよい先(withdrawn・pending は止める) */
export const BULK_STATUS_TARGETS = ["active", "inactive", "suspended", "banned", "security_locked"] as const satisfies readonly UserStatus[];

const CHUNK = 200;

export type BulkChangeStatusParams = {
  userIds: string[];
  newStatus: UserStatus;
  /** 監査に残る理由(必須) */
  reason: string;
  /** この状態の人だけ変える(並びを絞るだけ。並びに無い人には届かない) */
  onlyFrom?: UserStatus;
  dryRun?: boolean;
};

export type BulkChangeStatusResult = {
  dryRun: boolean;
  /** 変えた(dryRun では変える)人 */
  changed: Array<{ userId: string; from: UserStatus }>;
  skipped: Array<{ userId: string; why: string }>;
  failed: Array<{ userId: string; error: string }>;
};

/** 先に止める誤り(何も読まない・書かない) */
function assertParams(params: BulkChangeStatusParams): void {
  if (!(BULK_STATUS_TARGETS as readonly string[]).includes(params.newStatus)) {
    throw new DomainError(`一括で ${params.newStatus} には変えられません(変えられる先: ${BULK_STATUS_TARGETS.join(" / ")}。退会は退会の流れで)`, { status: 400 });
  }
  if (!params.reason?.trim()) throw new DomainError("変更の理由(reason)を指定してください。", { status: 400 });
  if (!Array.isArray(params.userIds) || params.userIds.length === 0) throw new DomainError("ユーザーの id がありません。", { status: 400 });
  if (new Set(params.userIds).size !== params.userIds.length) throw new DomainError("ユーザーの id が重なっています。", { status: 400 });
  if (params.onlyFrom === params.newStatus) throw new DomainError("onlyFrom と変える先が同じです。", { status: 400 });
}

/** 1 人分の飛ばす理由(null = 変える) */
function skipReason(user: User | undefined, params: BulkChangeStatusParams): string | null {
  if (!user) return "知らない id";
  if (user.deletedAt) return "削除済み";
  if (getRoleCategory(user.role) === "admin") return `管理者のロール(${user.role})は一括で変えない(1 人ずつの画面で)`;
  if (user.status === params.newStatus) return `既に ${params.newStatus}`;
  if (params.onlyFrom && user.status !== params.onlyFrom) return `今は ${user.status}(--from ${params.onlyFrom} でない)`;
  return null;
}

export async function bulkChangeStatus(params: BulkChangeStatusParams): Promise<BulkChangeStatusResult> {
  assertParams(params);
  const dryRun = params.dryRun === true;
  const reason = params.reason.trim();
  const result: BulkChangeStatusResult = { dryRun, changed: [], skipped: [], failed: [] };

  for (let at = 0; at < params.userIds.length; at += CHUNK) {
    const ids = params.userIds.slice(at, at + CHUNK);
    const { results } = await base.searchWithDeleted({ where: { field: "id", op: "in", value: ids }, limit: ids.length });
    const byId = new Map((results as User[]).map((user) => [user.id, user]));
    for (const userId of ids) {
      const user = byId.get(userId);
      const why = skipReason(user, params);
      if (why) {
        result.skipped.push({ userId, why });
        continue;
      }
      const current = user as User;
      if (dryRun) {
        result.changed.push({ userId, from: current.status });
        continue;
      }
      try {
        await db.transaction((trx) => changeStatus({ userId, newStatus: params.newStatus, reason }, trx));
        result.changed.push({ userId, from: current.status });
      } catch (error) {
        result.failed.push({ userId, error: error instanceof Error ? error.message : String(error) });
        continue;
      }
      // 確定の後(セッション失効は Firebase にも届く)。落ちても状態の変更は確定している
      try {
        await afterStatusChange(current, params.newStatus, reason);
      } catch (error) {
        result.failed.push({ userId, error: `状態は変えたが確定の後の処理(セッション失効)に失敗: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
  }
  return result;
}
