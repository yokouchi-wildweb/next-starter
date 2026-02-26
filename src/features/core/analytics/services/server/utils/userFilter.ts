// src/features/core/analytics/services/server/utils/userFilter.ts
// ユーザーフィルター条件ビルダー（roles ホワイトリスト + デモユーザー除外）

import { inArray, notInArray, eq, type SQL, type Column } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import type { UserFilter } from "@/features/core/analytics/types/common";

/**
 * ユーザーフィルターのSQL条件を生成する
 *
 * - roles指定時: user_id IN (SELECT id FROM users WHERE role IN (...))
 * - excludeDemo時: user_id NOT IN (SELECT id FROM users WHERE is_demo = true)
 * - 両方指定時: 両条件をANDで結合（呼び出し側で配列に追加）
 *
 * @param userIdColumn - user_idカラム参照（WalletHistoryTable.user_id 等）
 * @param params - ユーザーフィルターパラメータ
 * @returns SQL条件の配列（空配列 = フィルターなし）
 */
export function buildUserFilterConditions(
  userIdColumn: Column,
  params: UserFilter,
): SQL[] {
  const conditions: SQL[] = [];

  if (params.roles) {
    const roleList = params.roles.split(",").map((s) => s.trim()).filter(Boolean);
    if (roleList.length > 0) {
      const userIdsWithRoles = db
        .select({ id: UserTable.id })
        .from(UserTable)
        .where(inArray(UserTable.role, roleList as [string, ...string[]]));
      conditions.push(inArray(userIdColumn, userIdsWithRoles));
    }
  }

  if (params.excludeDemo) {
    const demoUserIds = db
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(eq(UserTable.isDemo, true));
    conditions.push(notInArray(userIdColumn, demoUserIds));
  }

  return conditions;
}

/**
 * URLSearchParamsからUserFilterパラメータを抽出する
 */
export function parseUserFilterParams(searchParams: URLSearchParams): UserFilter {
  const roles = searchParams.get("roles");
  const excludeDemo = searchParams.get("excludeDemo");

  return {
    ...(roles && { roles }),
    ...(excludeDemo === "true" && { excludeDemo: true }),
  };
}
