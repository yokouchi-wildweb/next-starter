// src/features/core/user/services/server/wrappers/searchWithProfile.ts
//
// ユーザー + プロフィールの横断検索。
// ユーザーテーブルのフィールドとプロフィールテーブルのフィールドを
// OR で横断検索し、統一的な検索結果を返す。
// profileWhere でプロフィールフィールドの構造化フィルタも可能。

import { and, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { getDomainConfig } from "@/lib/domain";
import type { SearchParams, PaginatedResult, WithOptions, WhereExpr } from "@/lib/crud/types";
import type { ExtraWhereOption } from "@/lib/crud/drizzle/types";
import type { User } from "@/features/core/user/entities";
import { getProfileConfig } from "@/features/core/userProfile/utils/configHelpers";
import { PROFILE_TABLE_MAP } from "@/registry/profileTableRegistry";
import { buildWhere } from "@/lib/crud/drizzle/query/buildWhere";
import { base } from "../drizzleBase";

export type SearchWithProfileParams = SearchParams & WithOptions & ExtraWhereOption & {
  /** プロフィールフィールドの構造化フィルタ（WhereExpr DSL） */
  profileWhere?: WhereExpr;
};

/**
 * ユーザー + プロフィールの横断検索。
 *
 * searchQuery が指定された場合:
 * - ユーザーテーブルの searchFields（domain.json）で ILIKE 検索
 * - 指定ロールのプロフィールテーブルの searchFields（profile.json）で EXISTS + ILIKE 検索
 * - これらを OR で結合
 *
 * profileWhere が指定された場合:
 * - プロフィールテーブルのフィールドで WhereExpr DSL による構造化フィルタ
 * - EXISTS サブクエリとして AND 結合
 *
 * searchQuery と profileWhere は独立して機能し、両方指定すれば AND 結合。
 *
 * @param role - 検索対象のロール（プロフィールの searchFields を取得するために使用）
 * @param params - 検索パラメータ
 *
 * @example
 * ```ts
 * // テキスト横断検索 + プロフィールフィルタ
 * const result = await userService.searchWithProfile("contributor", {
 *   searchQuery: "田中",
 *   profileWhere: {
 *     and: [
 *       { field: "prefecture", op: "eq", value: "東京都" },
 *       { field: "age", op: "gte", value: 20 },
 *     ],
 *   },
 *   page: 1,
 *   limit: 20,
 * });
 *
 * // profileWhere のみ（テキスト検索なし）
 * const result = await userService.searchWithProfile("contributor", {
 *   profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
 *   page: 1,
 *   limit: 20,
 * });
 * ```
 */
export async function searchWithProfile(
  role: string,
  params: SearchWithProfileParams = {},
): Promise<PaginatedResult<User>> {
  const { searchQuery, profileWhere } = params;

  // searchQuery も profileWhere もなければ通常検索
  if (!searchQuery && !profileWhere) {
    return base.search(params) as Promise<PaginatedResult<User>>;
  }

  const profileTable = PROFILE_TABLE_MAP[role];

  // プロフィールテーブルが存在しない場合は通常検索にフォールバック
  if (!profileTable) {
    return base.search(params) as Promise<PaginatedResult<User>>;
  }

  const conditions: SQL[] = [];

  // --- テキスト横断検索（searchQuery） ---
  if (searchQuery) {
    const profileConfig = getProfileConfig(role);
    const profileSearchFields = profileConfig?.searchFields ?? [];

    const pattern = `%${searchQuery}%`;

    // ユーザー側の検索条件（domain.json の searchFields）
    const userConf = getDomainConfig("user");
    const userSearchFields: string[] = userConf.searchFields ?? [];
    const userConds = userSearchFields
      .map((field) => {
        const column = (UserTable as any)[field];
        if (!column) return undefined;
        return sql`${column} ILIKE ${pattern}`;
      })
      .filter((c): c is SQL => c !== undefined);

    // プロフィール側の検索条件（EXISTS サブクエリ）
    const profileConds = profileSearchFields
      .map((field) => {
        const column = profileTable[field];
        if (!column) return undefined;
        return sql`${column} ILIKE ${pattern}`;
      })
      .filter((c): c is SQL => c !== undefined);

    if (profileConds.length) {
      const profileOrSql = sql.join(profileConds, sql` OR `);
      const existsCond = sql`EXISTS (SELECT 1 FROM ${profileTable} WHERE ${profileTable.userId} = ${UserTable.id} AND (${profileOrSql}))`;
      const allTextConds = [...userConds, existsCond];
      conditions.push(
        allTextConds.length === 1 ? allTextConds[0] : or(...allTextConds)! as SQL,
      );
    } else if (userConds.length) {
      // プロフィール側の searchFields がない場合はユーザー側のみ
      conditions.push(
        userConds.length === 1 ? userConds[0] : or(...userConds)! as SQL,
      );
    }
  }

  // --- 構造化フィルタ（profileWhere） ---
  if (profileWhere) {
    const profileFilterSql = buildWhere(profileTable, profileWhere);
    const existsFilter = sql`EXISTS (SELECT 1 FROM ${profileTable} WHERE ${profileTable.userId} = ${UserTable.id} AND (${profileFilterSql}))`;
    conditions.push(existsFilter);
  }

  // 条件がなければ通常検索にフォールバック
  if (!conditions.length) {
    return base.search(params) as Promise<PaginatedResult<User>>;
  }

  // searchQuery / profileWhere を除いた params で base.search() を呼ぶ
  const {
    searchQuery: _sq,
    searchFields: _sf,
    profileWhere: _pw,
    extraWhere: existingExtraWhere,
    ...rest
  } = params;

  const combined = conditions.length === 1
    ? conditions[0]
    : and(...conditions)! as SQL;

  const finalExtraWhere: SQL = existingExtraWhere
    ? sql`${existingExtraWhere} AND (${combined})`
    : combined;

  return base.search({
    ...rest,
    extraWhere: finalExtraWhere,
  }) as Promise<PaginatedResult<User>>;
}
