// src/features/userLineProfile/services/server/wrappers/findByUserId.ts

import { eq } from "drizzle-orm";

import type { UserLineProfile } from "@/features/core/userLineProfile/entities/model";
import { UserLineProfileTable } from "@/features/core/userLineProfile/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * ユーザーIDで LINE 連携プロフィールを検索する。
 */
export async function findByUserId(
  userId: string,
): Promise<UserLineProfile | null> {
  const profile = await db.query.UserLineProfileTable.findFirst({
    where: eq(UserLineProfileTable.userId, userId),
  });

  return profile ?? null;
}
