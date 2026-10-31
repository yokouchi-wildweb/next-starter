// src/features/user/services/server/finders/findByLocalEmail.ts

import { and, eq } from "drizzle-orm";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * ローカル認証用メールアドレスでユーザーを検索する。
 * ローカルログイン時の認証処理で使用する。
 */
export async function findByLocalEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.trim();

  const [user] = await db
    .select()
    .from(UserTable)
    .where(and(eq(UserTable.providerType, "local"), eq(UserTable.email, normalizedEmail)))
    .limit(1);

  return user ?? null;
}
