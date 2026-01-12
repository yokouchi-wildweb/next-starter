// src/features/core/userProfile/services/server/operations/upsertProfile.ts

import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { getProfileBase } from "../registry";

/**
 * プロフィール作成/更新用データ型
 */
export type ProfileUpsertData = Record<string, unknown>;

/**
 * プロフィールを作成または更新（upsert）
 * userId の unique 制約で衝突した場合は更新
 */
export async function upsertProfile(
  userId: string,
  role: UserRoleType,
  data: ProfileUpsertData,
): Promise<Record<string, unknown>> {
  if (!hasRoleProfile(role)) {
    throw new Error(`Role "${role}" does not have a profile`);
  }

  const base = getProfileBase(role);
  if (!base) {
    throw new Error(`Profile base for role "${role}" is not registered`);
  }

  // upsert は userId での衝突検知（defaultUpsertConflictFields: ["userId"]）
  return base.upsert({ userId, ...data });
}
