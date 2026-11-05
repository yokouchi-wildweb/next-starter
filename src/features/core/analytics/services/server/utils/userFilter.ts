// src/features/core/analytics/services/server/utils/userFilter.ts
// ユーザーフィルター条件ビルダー（roles ホワイトリスト + デモユーザー除外 + 分析の除外条件）

import { inArray, notInArray, eq, type SQL, type Column } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { exclusionProviders } from "@/features/core/analytics/extensions/exclusionProviders";
import type { UserFilter } from "@/features/core/analytics/types/common";
import type {
  AnalyticsExclusionProvider,
  AnalyticsExclusionScope,
} from "@/features/core/analytics/services/server/exclusion/types";

/**
 * ユーザーフィルターのSQL条件を生成する
 *
 * - roles指定時: user_id IN (SELECT id FROM users WHERE role IN (...))
 * - excludeDemo時: user_id NOT IN (SELECT id FROM users WHERE is_demo = true)
 * - 両方指定時: 両条件をANDで結合（呼び出し側で配列に追加）
 *
 * - scope 指定時: 分析の除外条件（exclusionProviders の項目）を足す（buildExclusionConditions）
 *
 * @param userIdColumn - user_idカラム参照（WalletHistoryTable.user_id 等）
 * @param params - ユーザーフィルターパラメータ
 * @param scope - 集計の性質（flow = 事実の行 / stock = 人ごと）。省略時は除外条件を足さない（従来挙動）
 * @returns SQL条件の配列（空配列 = フィルターなし）
 */
export function buildUserFilterConditions(
  userIdColumn: Column,
  params: UserFilter,
  scope?: AnalyticsExclusionScope,
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

  if (scope) {
    conditions.push(...buildExclusionConditions(userIdColumn, params, scope));
  }

  return conditions;
}

/**
 * 分析の除外条件（exclusionProviders の項目）を SQL 条件の配列にする。
 * - flow: 有効な項目の flow({ source, rowId, userId })、stock: 有効な項目の stock({ userId })
 * - params.includeExcluded = true（除外の前後を比べる検証用）なら足さない
 * roles / excludeDemo を適用しない集計（紹介報酬の合計など）も、除外だけはこれで足す。
 *
 * @param providers - 項目の一覧（省略時は生成された一覧。テスト用の差し込み口）
 */
export function buildExclusionConditions(
  userIdColumn: Column,
  params: Pick<UserFilter, "includeExcluded">,
  scope: AnalyticsExclusionScope,
  providers: Readonly<Record<string, AnalyticsExclusionProvider>> = exclusionProviders,
): SQL[] {
  if (params.includeExcluded) return [];
  const conditions: SQL[] = [];
  for (const provider of Object.values(providers)) {
    if (provider.enabled && !provider.enabled()) continue;
    const condition =
      scope.kind === "flow"
        ? provider.flow?.({ source: scope.source, rowId: scope.rowId, userId: userIdColumn })
        : provider.stock?.({ userId: userIdColumn });
    if (condition) conditions.push(condition);
  }
  return conditions;
}

/**
 * URLSearchParamsからUserFilterパラメータを抽出する
 */
export function parseUserFilterParams(searchParams: URLSearchParams): UserFilter {
  const roles = searchParams.get("roles");
  const excludeDemo = searchParams.get("excludeDemo");
  const includeExcluded = searchParams.get("includeExcluded");

  return {
    ...(roles && { roles }),
    ...(excludeDemo === "true" && { excludeDemo: true }),
    ...(includeExcluded === "true" && { includeExcluded: true }),
  };
}
