// src/features/userXProfile/services/server/wrappers/findByUserId.ts

import { eq } from "drizzle-orm";

import type { UserXProfile } from "@/features/core/userXProfile/entities/model";
import { UserXProfileTable } from "@/features/core/userXProfile/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * ユーザーIDで X 連携プロフィールを検索する。
 */
export async function findByUserId(
  userId: string,
): Promise<UserXProfile | null> {
  const [profile] = await db
    .select()
    .from(UserXProfileTable)
    .where(eq(UserXProfileTable.userId, userId))
    .limit(1);

  return profile ?? null;
}
