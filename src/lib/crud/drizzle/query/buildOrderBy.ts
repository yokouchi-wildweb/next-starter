import { asc, desc, sql, SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { OrderBySpec } from "@/lib/crud/types";

/**
 * OrderBySpec に基づいて ORDER BY 句を構築する
 *
 * @param table - テーブル定義
 * @param spec - ソート指定の配列 [field, direction, nulls?]
 *   - direction: "ASC" | "DESC"
 *   - nulls (optional): "FIRST" | "LAST"
 */
export const buildOrderBy = (table: PgTable, spec?: OrderBySpec): SQL[] => {
  if (!spec || spec.length === 0) return [];
  return spec.map(([field, dir, nulls]) => {
    const column = (table as any)[field];
    // NULLS FIRST/LAST が指定されている場合は raw SQL を使用
    if (nulls) {
      const direction = dir === "ASC" ? sql`ASC` : sql`DESC`;
      const nullsOrder = nulls === "FIRST" ? sql`NULLS FIRST` : sql`NULLS LAST`;
      return sql`${column} ${direction} ${nullsOrder}`;
    }
    return dir === "ASC" ? asc(column) : desc(column);
  });
};
