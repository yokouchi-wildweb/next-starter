// src/domains/core/userProfile/services/server/operations/deleteProfile.ts

import { hasRoleProfile, type UserRoleType } from "@/domains/core/user/constants";
import { getProfileBase } from "../../../utils/profileBaseHelpers";

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

  return base.deleteByUserId(userId);
}
