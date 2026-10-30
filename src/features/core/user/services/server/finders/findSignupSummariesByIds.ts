// src/features/core/user/services/server/finders/findSignupSummariesByIds.ts

import { inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";

export type UserSignupSummary = { id: string; name: string | null; signupIp: string | null };

/**
 * 利用者 ID の一覧から、表示名と登録時 IP だけを一括で引く(管理者向けの紹介一覧の表示用)。
 * 行全体は読まない(秘匿列を含めない)。無い ID は結果に含まれない
 */
export async function findSignupSummariesByIds(ids: readonly string[]): Promise<UserSignupSummary[]> {
  if (ids.length === 0) return [];
  return db
    .select({ id: UserTable.id, name: UserTable.name, signupIp: UserTable.signupIp })
    .from(UserTable)
    .where(inArray(UserTable.id, [...ids]));
}
