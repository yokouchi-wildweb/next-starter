// src/domains/userLineProfile/services/server/wrappers/findByLineUserId.ts

import { eq } from "drizzle-orm";

import type { UserLineProfile } from "@/domains/core/userLineProfile/entities/model";
import { UserLineProfileTable } from "@/domains/core/userLineProfile/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * LINE userId で連携プロフィールを検索する。
 */
export async function findByLineUserId(
  lineUserId: string,
): Promise<UserLineProfile | null> {
  const [profile] = await db
    .select()
    .from(UserLineProfileTable)
    .where(eq(UserLineProfileTable.lineUserId, lineUserId))
    .limit(1);

  return profile ?? null;
}
