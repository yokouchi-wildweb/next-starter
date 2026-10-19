// src/lib/crud/drizzle/query/buildSearchRank.ts
//
// テキスト検索（searchQuery）に関する SQL 片の生成。
// - buildSearchWhere: 従来どおりの `ILIKE %q%` OR（結果集合を決める）
// - buildSearchRankOrderBy: 関連度スコア（完全 > 前置 > 語頭 > 部分 × weight の合算）の ORDER BY 片
//
// base.query() で独自 JOIN を組む wrapper からも同じ順位付けを再利用できるよう
// `@/lib/crud/drizzle` から公開している。
// NOTE: node --test から .ts を直接読むため、ランタイムの相対 import を持たないこと（drizzle-orm のみ）。

import { ilike, or, sql, SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { NormalizedSearchRankField } from "./searchRankSpec";

/** 一致種別ごとの基礎スコア（weight 1 のとき）。階層の順序だけが意味を持つ */
export const SEARCH_RANK_TIER_SCORES = {
  exact: 100,
  prefix: 60,
  wordStart: 40,
  substring: 20,
} as const;

/**
 * 語頭一致判定用の正規表現メタ文字エスケープ（PostgreSQL ARE / JS 共通で安全な範囲）。
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
}

/**
 * 語頭一致を判定する PostgreSQL 正規表現（`~*` で使用）。
 * 先頭、または空白・@・.・_・-・/ の直後からクエリが始まる位置を語頭とみなす。
 */
export function buildWordStartRegex(query: string): string {
  return `(^|[\\s@._/-])${escapeRegex(query)}`;
}

const resolveColumn = (table: PgTable, field: string): unknown =>
  (table as unknown as Record<string, unknown>)[field];

/**
 * searchFields の各カラムに `ILIKE %query%` を OR で結合した WHERE 片を返す。
 * 対象カラムが 1 つも解決できない場合は `FALSE`（検索要求を無視して全件返さない、fail-closed）。
 */
export const buildSearchWhere = (
  table: PgTable,
  searchQuery: string,
  searchFields: string[],
): SQL => {
  const pattern = `%${searchQuery}%`;
  const conds = searchFields
    .map((field) => resolveColumn(table, field))
    .filter((column) => column !== undefined)
    .map((column) => ilike(column as any, pattern));
  if (conds.length === 0) return sql`FALSE`;
  return or(...conds) as SQL;
};

/**
 * 関連度スコアの ORDER BY 片（`(score) DESC`）を返す。
 *
 * フィールドごとに
 *   CASE 完全一致 100 / 前置一致 60 / 語頭一致 40 / 部分一致 20 / ELSE 0 END * weight
 * を算出し合算する。複数フィールドに一致した行は合算で自然に加点される。
 * NULL カラムは全条件が偽となり 0 点。
 *
 * rankFields は normalizeSearchRankSpec() で正規化済み（searchFields との交差、weight 正数）を前提とする。
 * 解決できるカラムが無い場合は undefined。
 */
export const buildSearchRankOrderBy = (
  table: PgTable,
  searchQuery: string,
  rankFields: NormalizedSearchRankField[],
): SQL | undefined => {
  const prefixPattern = `${searchQuery}%`;
  const substringPattern = `%${searchQuery}%`;
  const wordStartRegex = buildWordStartRegex(searchQuery);
  const { exact, prefix, wordStart, substring } = SEARCH_RANK_TIER_SCORES;

  const terms = rankFields
    .map(({ field, weight }) => {
      const column = resolveColumn(table, field);
      if (column === undefined) return undefined;
      // weight は正規化済みの有限正数のみ到達するため raw 埋め込みで安全
      const weightLiteral = sql.raw(String(weight));
      return sql`(CASE
        WHEN lower(${column}::text) = lower(${searchQuery}) THEN ${sql.raw(String(exact))}
        WHEN ${column}::text ILIKE ${prefixPattern} THEN ${sql.raw(String(prefix))}
        WHEN ${column}::text ~* ${wordStartRegex} THEN ${sql.raw(String(wordStart))}
        WHEN ${column}::text ILIKE ${substringPattern} THEN ${sql.raw(String(substring))}
        ELSE 0 END * ${weightLiteral})`;
    })
    .filter((term): term is SQL => term !== undefined);

  if (terms.length === 0) return undefined;
  return sql`(${sql.join(terms, sql` + `)}) DESC`;
};

