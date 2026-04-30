// src/features/core/user/services/server/wrappers/changeRole.ts

import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/constants/role";
import { assertRoleEnabled, hasRoleProfile } from "@/features/core/user/utils/roleHelpers";
import { auditLogger } from "@/features/core/auditLog";
import { DomainError } from "@/lib/errors";
import { deleteProfile } from "@/features/core/userProfile/services/server/operations/deleteProfile";
import { base } from "../drizzleBase";

export type ChangeRoleInput = {
  userId: string;
  newRole: UserRoleType;
  reason?: string;
  deleteOldProfile?: boolean;
};

/**
 * ユーザーのロールを変更し、監査ログを記録する。
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function changeRole(input: ChangeRoleInput): Promise<User> {
  const { userId, newRole, reason, deleteOldProfile } = input;

  assertRoleEnabled(newRole);

  const currentUser = await base.get(userId);
  if (!currentUser) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  const beforeRole = currentUser.role;

  if (beforeRole === newRole) {
    throw new DomainError("現在と同じロールには変更できません", { status: 400 });
  }

  if (deleteOldProfile && beforeRole && hasRoleProfile(beforeRole)) {
    await deleteProfile(userId, beforeRole);
  }

  const updatePayload = { role: newRole } as Partial<User>;
  const updatedUser = await base.update(userId, updatePayload);

  await auditLogger.record({
    targetType: "user",
    targetId: userId,
    action: "user.role.changed",
    before: { role: beforeRole },
    after: { role: newRole, profileDeleted: deleteOldProfile ?? false },
    reason: reason ?? null,
  });

  return updatedUser;
}
