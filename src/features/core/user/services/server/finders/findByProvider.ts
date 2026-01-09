// src/features/user/services/server/finders/findByProvider.ts

import { and, eq } from "drizzle-orm";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import type { UserProviderType } from "@/features/core/user/types";

/**
 * プロバイダー情報でユーザーを検索する。
 * 認証サービスからユーザーを特定する際に使用する。
 */
export async function findByProvider(
  providerType: UserProviderType,
  providerUid: string,
): Promise<User | null> {
  const user = await db.query.UserTable.findFirst({
    where: and(eq(UserTable.providerType, providerType), eq(UserTable.providerUid, providerUid)),
  });

  return user ?? null;
}
