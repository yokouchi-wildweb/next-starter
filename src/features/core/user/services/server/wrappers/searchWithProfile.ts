// src/features/core/user/services/server/wrappers/searchWithProfile.ts
//
// ユーザー + プロフィールの横断検索。
// ユーザーテーブルのフィールドとプロフィールテーブルのフィールドを
// OR で横断検索し、統一的な検索結果を返す。

import { ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { getDomainConfig } from "@/lib/domain";
import type { SearchParams, PaginatedResult, WithOptions } from "@/lib/crud/types";
import type { ExtraWhereOption } from "@/lib/crud/drizzle/types";
import type { User } from "@/features/core/user/entities";
import { getProfileConfig } from "@/features/core/userProfile/utils/configHelpers";
import { PROFILE_TABLE_MAP } from "@/registry/profileTableRegistry";
import { base } from "../drizzleBase";

type SearchWithProfileParams = SearchParams & WithOptions & ExtraWhereOption;

/**
 * ユーザー + プロフィールの横断検索。
 *
 * searchQuery が指定された場合:
 * - ユーザーテーブルの searchFields（domain.json）で ILIKE 検索
 * - 指定ロールのプロフィールテーブルの searchFields（profile.json）で EXISTS + ILIKE 検索
 * - これらを OR で結合
 *
 * searchQuery がない場合や、ロールにプロフィール/searchFields がない場合は
 * 通常の base.search() にフォールバックする。
 *
 * @param role - 検索対象のロール（プロフィールの searchFields を取得するために使用）
 * @param params - 検索パラメータ（SearchParams + WithOptions + ExtraWhereOption）
 *
 * @example
 * ```ts
 * // SSR ページから
 * const result = await userService.searchWithProfile("contributor", {
 *   searchQuery: "田中",
 *   page: 1,
 *   limit: 20,
 * });
 * ```
 */
export async function searchWithProfile(
  role: string,
  params: SearchWithProfileParams = {},
): Promise<PaginatedResult<User>> {
  const { searchQuery } = params;

  // searchQuery がなければ通常検索
  if (!searchQuery) {
    return base.search(params) as Promise<PaginatedResult<User>>;
  }

  // プロフィール設定を取得
  const profileConfig = getProfileConfig(role);
  const profileSearchFields = profileConfig?.searchFields ?? [];
  const profileTable = PROFILE_TABLE_MAP[role];

  // プロフィール側の検索フィールドがない場合は通常検索にフォールバック
  if (!profileSearchFields.length || !profileTable) {
    return base.search(params) as Promise<PaginatedResult<User>>;
  }

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

  // プロフィール側の検索フィールドが解決できなかった場合
  if (!profileConds.length) {
    return base.search(params) as Promise<PaginatedResult<User>>;
  }

  const profileOrSql = sql.join(profileConds, sql` OR `);
  const existsCond = sql`EXISTS (SELECT 1 FROM ${profileTable} WHERE ${profileTable.userId} = ${UserTable.id} AND (${profileOrSql}))`;

  // ユーザー検索条件 + プロフィール EXISTS を OR で結合
  const allConds = [...userConds, existsCond];
  const combinedSearch = allConds.length === 1
    ? allConds[0]
    : or(...allConds)!;

  // searchQuery を除いた params で base.search() を呼ぶ
  // （検索条件は extraWhere として手動注入するため）
  const { searchQuery: _sq, searchFields: _sf, extraWhere: existingExtraWhere, ...rest } = params;

  const finalExtraWhere: SQL = existingExtraWhere
    ? sql`${existingExtraWhere} AND (${combinedSearch})`
    : (combinedSearch as SQL);

  return base.search({
    ...rest,
    extraWhere: finalExtraWhere,
  }) as Promise<PaginatedResult<User>>;
}
