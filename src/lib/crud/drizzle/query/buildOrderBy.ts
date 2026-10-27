import { asc, desc, sql, SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { OrderBySpec } from "@/lib/crud/types";
import { sortKeyExpr } from "../fractionalSort/sortKeyOrder";

export type BuildOrderByOptions = {
  /** サービスの並びの列（sortOrderColumn）。これを名指しする指定は鍵の順（text は COLLATE "C"）で並べる */
  sortKeyColumn?: AnyPgColumn;
};

/**
 * OrderBySpec に基づいて ORDER BY 句を構築する
 *
 * @param table - テーブル定義
 * @param spec - ソート指定の配列 [field, direction, nulls?]
 *   - direction: "ASC" | "DESC"
 *   - nulls (optional): "FIRST" | "LAST"
 * @param options.sortKeyColumn - 並びの列（指定すると、その列の指定は sortKeyExpr で並べる）
 */
export const buildOrderBy = (table: PgTable, spec?: OrderBySpec, options: BuildOrderByOptions = {}): SQL[] => {
  if (!spec || spec.length === 0) return [];
  return spec.map(([field, dir, nulls]) => {
    const tableColumn = (table as any)[field];
    const column =
      options.sortKeyColumn && tableColumn === options.sortKeyColumn ? sortKeyExpr(tableColumn) : tableColumn;
    // NULLS FIRST/LAST が指定されている場合は raw SQL を使用
    if (nulls) {
      const direction = dir === "ASC" ? sql`ASC` : sql`DESC`;
      const nullsOrder = nulls === "FIRST" ? sql`NULLS FIRST` : sql`NULLS LAST`;
      return sql`${column} ${direction} ${nullsOrder}`;
    }
    return dir === "ASC" ? asc(column) : desc(column);
  });
};
