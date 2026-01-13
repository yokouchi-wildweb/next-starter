// src/features/core/userProfile/services/server/operations/getProfile.ts

import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { getProfileBase } from "../../../utils/profileBaseHelpers";

/**
 * プロフィールを取得
 */
export async function getProfile(
  userId: string,
  role: UserRoleType,
): Promise<Record<string, unknown> | null> {
  if (!hasRoleProfile(role)) {
    return null;
  }

  const base = getProfileBase(role);
  if (!base) {
    return null;
  }

  return base.getByUserId(userId);
}
