// src/features/core/user/services/server/wrappers/changeRole.ts

import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/constants/role";
import { assertRoleEnabled, hasRoleProfile } from "@/features/core/user/utils/roleHelpers";
import { DomainError } from "@/lib/errors";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { deleteProfile } from "@/features/core/userProfile/services/server/operations/deleteProfile";
import { base } from "../drizzleBase";

export type ChangeRoleInput = {
  userId: string;
  newRole: UserRoleType;
  actorId: string;
  reason?: string;
  deleteOldProfile?: boolean;
};

/**
 * ユーザーのロールを変更し、アクションログを記録する
 */
export async function changeRole(input: ChangeRoleInput): Promise<User> {
  const { userId, newRole, actorId, reason, deleteOldProfile } = input;

  // ロールの存在・有効性チェック
  assertRoleEnabled(newRole);

  // 現在のユーザー情報を取得
  const currentUser = await base.get(userId);
  if (!currentUser) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  const beforeRole = currentUser.role;

  // 同じロールへの変更は不可
  if (beforeRole === newRole) {
    throw new DomainError("現在と同じロールには変更できません", { status: 400 });
  }

  // 旧ロールのプロフィールを削除（オプション）
  if (deleteOldProfile && beforeRole && hasRoleProfile(beforeRole)) {
    await deleteProfile(userId, beforeRole);
  }

  // ロールを更新
  const updatePayload = { role: newRole } as Partial<User>;
  const updatedUser = await base.update(userId, updatePayload);

  // アクションログを記録
  await userActionLogService.create({
    targetUserId: userId,
    actorId,
    actorType: "admin",
    actionType: "admin_role_change",
    beforeValue: { role: beforeRole },
    afterValue: { role: newRole, profileDeleted: deleteOldProfile ?? false },
    reason: reason ?? null,
  });

  return updatedUser;
}
