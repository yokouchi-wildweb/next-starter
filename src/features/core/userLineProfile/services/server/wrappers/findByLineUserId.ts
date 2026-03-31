// src/features/userLineProfile/services/server/wrappers/findByLineUserId.ts

import { eq } from "drizzle-orm";

import type { UserLineProfile } from "@/features/core/userLineProfile/entities/model";
import { UserLineProfileTable } from "@/features/core/userLineProfile/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * LINE userId で連携プロフィールを検索する。
 */
export async function findByLineUserId(
  lineUserId: string,
): Promise<UserLineProfile | null> {
  const profile = await db.query.UserLineProfileTable.findFirst({
    where: eq(UserLineProfileTable.lineUserId, lineUserId),
  });

  return profile ?? null;
}
