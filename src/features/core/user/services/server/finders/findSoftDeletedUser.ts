// src/features/core/user/services/server/finders/findSoftDeletedUser.ts

import { and, eq, isNotNull } from "drizzle-orm";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import type { UserProviderType } from "@/features/core/user/types";

export type FindSoftDeletedUserParams = {
  providerType: UserProviderType;
  email: string;
};

/**
 * 指定したプロバイダー種別とメールアドレスでソフトデリート済みユーザーを検索する。
 * ソフトデリート済みユーザーが見つかった場合はそのユーザーを返し、見つからない場合はnullを返す。
 */
export async function findSoftDeletedUser({
  providerType,
  email,
}: FindSoftDeletedUserParams): Promise<User | null> {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return null;
  }

  const [user] = await db
    .select()
    .from(UserTable)
    .where(
      and(
        eq(UserTable.providerType, providerType),
        eq(UserTable.email, normalizedEmail),
        isNotNull(UserTable.deletedAt),
      ),
    )
    .limit(1);

  return user ?? null;
}
