// src/features/user/services/server/finders/checkAdminUserExists.ts

import { inArray } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { getRolesByCategory } from "@/features/core/user/constants";
import { db } from "@/lib/drizzle";

/**
 * 管理者カテゴリのユーザーが存在するかを確認する。
 * 初期セットアップ時の判定に使用する。
 */
export async function checkAdminUserExists(): Promise<boolean> {
  const adminRoles = getRolesByCategory("admin");
  const [adminUser] = await db
    .select({ id: UserTable.id })
    .from(UserTable)
    .where(inArray(UserTable.role, adminRoles))
    .limit(1);

  return Boolean(adminUser);
}
