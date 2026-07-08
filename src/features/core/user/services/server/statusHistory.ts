// src/features/core/user/services/server/statusHistory.ts

import { UserStatusHistoryTable } from "@/features/core/user/entities/drizzle";
import type { UserStatusTransitionTrigger } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { db } from "@/lib/drizzle";

export type RecordStatusTransitionInput = {
  userId: string;
  /** 遷移前ステータス。新規作成（INSERT）の場合は null */
  fromStatus: UserStatus | null;
  toStatus: UserStatus;
  trigger: UserStatusTransitionTrigger;
  /** 呼び出し元がトランザクション内なら必ず渡す（本体更新とのロールバック整合性） */
  tx?: DbTransaction;
};

/**
 * ユーザーステータス遷移を user_status_histories に記録する（常時オン）。
 *
 * - fromStatus === toStatus の場合は no-op（upsert 等で同一ステータスが再設定されるケース）
 * - 集計用の恒久データ。保持期限つきの audit_logs とは責務が別（こちらは prune されない）
 *
 * 【重要】users.status を書き換える処理を新設・変更したら、必ず本関数の呼び出しを追加すること。
 * 既存の記録箇所: withdraw / pause / reactivate / softDelete / changeStatus / activate /
 * setPending / restore / createAdmin / createGeneralUser / createDemoUser /
 * createGuestDemoUser / lockoutPolicy(recordFailedLogin)
 */
export async function recordStatusTransition(
  input: RecordStatusTransitionInput,
): Promise<void> {
  const { userId, fromStatus, toStatus, trigger, tx } = input;

  if (fromStatus === toStatus) {
    return;
  }

  const executor = tx ?? db;
  await executor.insert(UserStatusHistoryTable).values({
    userId,
    fromStatus,
    toStatus,
    trigger,
  });
}
