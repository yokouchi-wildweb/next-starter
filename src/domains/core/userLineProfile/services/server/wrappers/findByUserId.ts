// src/domains/userLineProfile/services/server/wrappers/findByUserId.ts

import { eq } from "drizzle-orm";

import type { UserLineProfile } from "@/domains/core/userLineProfile/entities/model";
import { UserLineProfileTable } from "@/domains/core/userLineProfile/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * ユーザーIDで LINE 連携プロフィールを検索する。
 */
export async function findByUserId(
  userId: string,
): Promise<UserLineProfile | null> {
  const [profile] = await db
    .select()
    .from(UserLineProfileTable)
    .where(eq(UserLineProfileTable.userId, userId))
    .limit(1);

  return profile ?? null;
}
