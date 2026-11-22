// src/domains/userXProfile/services/server/wrappers/findByXUserId.ts

import { eq } from "drizzle-orm";

import type { UserXProfile } from "@/domains/core/userXProfile/entities/model";
import { UserXProfileTable } from "@/domains/core/userXProfile/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * X userId で連携プロフィールを検索する。
 */
export async function findByXUserId(
  xUserId: string,
): Promise<UserXProfile | null> {
  const [profile] = await db
    .select()
    .from(UserXProfileTable)
    .where(eq(UserXProfileTable.xUserId, xUserId))
    .limit(1);

  return profile ?? null;
}
