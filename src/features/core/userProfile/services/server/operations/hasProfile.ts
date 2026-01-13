// src/features/core/userProfile/services/server/operations/hasProfile.ts

import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { getProfileBase } from "../../../utils/profileBaseHelpers";

/**
 * プロフィールが存在するか確認
 */
export async function hasProfile(
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

  return base.existsByUserId(userId);
}
