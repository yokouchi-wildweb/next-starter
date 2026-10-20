// src/lib/crud/drizzle/query/withIdTiebreak.ts
//
// ORDER BY の末尾に一意な id を足し、並び順を確定させる（同順位の行の並びを DB 任せにしない）。
// base.search() / searchWithDeleted() と同じ規則。base.query() で独自 JOIN を組む wrapper も、
// 並び順の最後はこれで閉じる（無いとページをまたいで同順位の行が入れ替わる・重複・欠落する）。
// NOTE: node --test から .ts を直接読むため、ランタイムの相対 import を持たないこと（drizzle-orm のみ）。

import { asc, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/** OrderBySpec の要素のうち、判定に使う field だけを見る（型は @/lib/crud/types の OrderBySpec と互換） */
type OrderBySpecLike = ReadonlyArray<readonly [string, ...unknown[]]>;

/**
 * `clauses` の末尾に `asc(table.id)` を足した新しい配列を返す。
 * `orderBy` に既に `id` が含まれる場合と、テーブルに `id` カラムが無い場合は `clauses` をそのまま（コピーして）返す。
 *
 * @param table - 対象テーブル
 * @param orderBy - 呼び出し側の OrderBySpec（id を含むかの判定にだけ使う）
 * @param clauses - 組み立て済みの ORDER BY 片（searchRank の句 + buildOrderBy の結果など）
 */
export const withIdTiebreak = (
  table: PgTable,
  orderBy: OrderBySpecLike | undefined,
  clauses: SQL[],
): SQL[] => {
  const idColumn = (table as unknown as Record<string, unknown>).id;
  if (idColumn === undefined) return [...clauses];
  if (orderBy?.some(([field]) => field === "id")) return [...clauses];
  return [...clauses, asc(idColumn as Parameters<typeof asc>[0])];
};

/**
 * base.search() / searchWithDeleted() の ORDER BY を合成する。
 * 順序: searchRank の句 → extraOrderBy（SQL 式）→ orderBy（buildOrderBy の結果）→ id（withIdTiebreak）。
 * rank / extra が無ければ従来どおり orderBy → id になる。
 *
 * @param table - 対象テーブル
 * @param orderBy - 呼び出し側の OrderBySpec（id を含むかの判定にだけ使う）
 * @param parts.rank - searchRank の句（searchQuery 指定時のみ）
 * @param parts.extra - extraOrderBy（呼び出し側が渡した Drizzle SQL 式）
 * @param parts.base - buildOrderBy(table, orderBy) の結果
 */
export const composeSearchOrderBy = (
  table: PgTable,
  orderBy: OrderBySpecLike | undefined,
  parts: { rank?: SQL; extra?: SQL[]; base: SQL[] },
): SQL[] =>
  withIdTiebreak(table, orderBy, [
    ...(parts.rank ? [parts.rank] : []),
    ...(parts.extra ?? []),
    ...parts.base,
  ]);
