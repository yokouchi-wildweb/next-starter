// src/features/user/services/server/finders/findByLineUserId.ts

import { and, eq, isNull } from "drizzle-orm";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * LINE userId でユーザーを検索する。
 * LINE連携済みのアクティブユーザーを特定する際に使用する。
 */
export async function findByLineUserId(
  lineUserId: string,
): Promise<User | null> {
  const user = await db.query.UserTable.findFirst({
    where: and(
      eq(UserTable.lineUserId, lineUserId),
      isNull(UserTable.deletedAt),
    ),
  });

  return user ?? null;
}
