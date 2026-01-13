// src/features/core/userProfile/services/server/operations/deleteProfile.ts

import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { getProfileBase } from "../../../utils";

/**
 * プロフィールを削除
 */
export async function deleteProfile(
  userId: string,
  role: UserRoleType,
): Promise<boolean> {
  if (!hasRoleProfile(role)) {
    return false;
  }

  const base = getProfileBase(role);
  if (!base) {
    return false;
  }

  return base.removeByUserId(userId);
}
