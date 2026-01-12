// src/features/core/userProfile/services/server/operations/updateProfile.ts

import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { getProfileBase } from "../registry";

/**
 * プロフィール更新用データ型
 */
export type ProfileUpdateData = Record<string, unknown>;

/**
 * プロフィールを更新
 */
export async function updateProfile(
  userId: string,
  role: UserRoleType,
  data: ProfileUpdateData,
): Promise<Record<string, unknown> | null> {
  if (!hasRoleProfile(role)) {
    return null;
  }

  const base = getProfileBase(role);
  if (!base) {
    return null;
  }

  return base.updateByUserId(userId, data);
}
