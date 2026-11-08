// src/features/core/user/services/server/wrappers/changeStatus.ts

import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { invalidateSessionsForUser } from "@/features/core/auth/services/server/sessionInvalidation";
import { recordStatusTransition } from "@/features/core/user/services/server/statusHistory";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { runWithTransaction } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors";
import { base } from "../drizzleBase";

export type ChangeStatusInput = {
  userId: string;
  newStatus: UserStatus;
  reason?: string;
};

/** 遷移の前の状態(確定の後の処理 afterStatusChange に渡す) */
export type StatusChangeBefore = Pick<User, "id" | "status" | "providerUid" | "failedLoginCount">;

/**
 * ユーザーのステータスを変更し、遷移の履歴と監査ログを記録する。
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 *
 * - users の更新・user_status_histories・監査 user.status.changed は 1 つの transaction で書く(tx を渡せばその中)
 * - 確定の後の処理(banned / security_locked のセッション失効 = Firebase にも届く、ロック解除の監査)は、
 *   tx を渡さない時だけここで行う。tx を渡した呼び手は commit の後に afterStatusChange(before, newStatus, reason) を呼ぶ
 */
export async function changeStatus(input: ChangeStatusInput, tx?: DbTransaction): Promise<User> {
  const { userId, newStatus, reason } = input;

  const currentUser = await base.get(userId);
  if (!currentUser) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  const beforeStatus = currentUser.status;

  if (beforeStatus === newStatus) {
    throw new DomainError("現在と同じステータスには変更できません", { status: 400 });
  }

  // security_locked から別ステータスへ遷移するときは「管理者によるロック解除」を意味する。
  // ロックアウト関連カウンタを同時リセットし、再ログイン可能な状態に戻す。
  const isAdminUnlock = beforeStatus === "security_locked" && newStatus !== "security_locked";

  const updatePayload: Partial<User> = { status: newStatus };
  if (isAdminUnlock) {
    updatePayload.failedLoginCount = 0;
    updatePayload.lockedUntil = null;
    updatePayload.lastFailedLoginAt = null;
  }

  const updatedUser = await runWithTransaction(tx, async (trx) => {
    const updated = await base.update(userId, updatePayload, trx);

    await recordStatusTransition({
      userId,
      fromStatus: beforeStatus,
      toStatus: newStatus,
      trigger: "admin_change_status",
      tx: trx,
    });

    await auditLogger.record({
      targetType: "user",
      targetId: userId,
      subjectUserId: userId,
      action: "user.status.changed",
      before: { status: beforeStatus },
      after: { status: newStatus },
      reason: reason ?? null,
      tx: trx,
    });
    return updated;
  });

  if (!tx) await afterStatusChange(currentUser, newStatus, reason);

  return updatedUser;
}

/**
 * ステータスの変更が確定した後の処理(transaction の外。changeStatus に tx を渡した呼び手が commit の後に呼ぶ)。
 * - security_locked から外した: ロック解除の監査 auth.account.unlocked_admin(bestEffort)
 * - banned / security_locked にした: 既存セッションを即時失効(有効な JWT が残ったまま access され続けるのを防ぐ)
 */
export async function afterStatusChange(before: StatusChangeBefore, newStatus: UserStatus, reason?: string): Promise<void> {
  if (before.status === "security_locked" && newStatus !== "security_locked") {
    await auditLogger.record({
      targetType: "user",
      targetId: before.id,
      subjectUserId: before.id,
      action: "auth.account.unlocked_admin",
      before: {
        status: "security_locked",
        failedLoginCount: before.failedLoginCount,
      },
      after: { status: newStatus, failedLoginCount: 0 },
      reason: reason ?? null,
      bestEffort: true,
    });
  }

  if (newStatus === "banned" || newStatus === "security_locked") {
    await invalidateSessionsForUser({
      userId: before.id,
      providerUid: before.providerUid,
      reason: newStatus === "banned" ? "status_ban" : "status_lock",
    });
  }
}
