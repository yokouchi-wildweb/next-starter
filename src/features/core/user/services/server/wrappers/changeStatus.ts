// src/features/core/user/services/server/wrappers/changeStatus.ts

import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { invalidateSessionsForUser } from "@/features/core/auth/services/server/sessionInvalidation";
import { DomainError } from "@/lib/errors";
import { base } from "../drizzleBase";

export type ChangeStatusInput = {
  userId: string;
  newStatus: UserStatus;
  reason?: string;
};

/**
 * ユーザーのステータスを変更し、監査ログを記録する。
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function changeStatus(input: ChangeStatusInput): Promise<User> {
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
  const updatedUser = await base.update(userId, updatePayload);

  await auditLogger.record({
    targetType: "user",
    targetId: userId,
    action: "user.status.changed",
    before: { status: beforeStatus },
    after: { status: newStatus },
    reason: reason ?? null,
  });

  if (isAdminUnlock) {
    await auditLogger.record({
      targetType: "user",
      targetId: userId,
      action: "auth.account.unlocked_admin",
      before: {
        status: "security_locked",
        failedLoginCount: currentUser.failedLoginCount,
      },
      after: { status: newStatus, failedLoginCount: 0 },
      reason: reason ?? null,
      bestEffort: true,
    });
  }

  // banned / security_locked への遷移時は既存セッションを即時失効させる
  // (有効な JWT が残ったまま access され続けるのを防ぐ)。
  if (newStatus === "banned" || newStatus === "security_locked") {
    await invalidateSessionsForUser({
      userId,
      providerUid: currentUser.providerUid,
      reason: newStatus === "banned" ? "status_ban" : "status_lock",
    });
  }

  return updatedUser;
}
