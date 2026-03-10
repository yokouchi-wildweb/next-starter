import { and, eq, ne, lt, lte, gt, gte, ilike, isNull, isNotNull, or, SQL, sql, inArray, notInArray } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { WhereExpr } from "@/lib/crud/types";

export const buildWhere = (table: PgTable, expr?: WhereExpr): SQL => {
  if (!expr) return sql`TRUE`;
  if ("field" in expr) {
    const col = (table as any)[expr.field];
    switch (expr.op) {
      // 比較
      case "eq":
        return eq(col, expr.value as any);
      case "ne":
        return ne(col, expr.value as any);
      case "lt":
        return lt(col, expr.value as any);
      case "lte":
        return lte(col, expr.value as any);
      case "gt":
        return gt(col, expr.value as any);
      case "gte":
        return gte(col, expr.value as any);
      // テキスト
      case "like":
        return ilike(col, String(expr.value));
      case "startsWith":
        return ilike(col, `${expr.value}%`);
      case "endsWith":
        return ilike(col, `%${expr.value}`);
      // リスト
      case "in":
        return inArray(col, expr.value as any[]);
      case "notIn":
        return notInArray(col, expr.value as any[]);
      // NULL
      case "isNull":
        return isNull(col);
      case "isNotNull":
        return isNotNull(col);
      // JSONB
      case "contains":
        return sql`${col} @> ${JSON.stringify(expr.value)}::jsonb`;
      case "containedBy":
        return sql`${col} <@ ${JSON.stringify(expr.value)}::jsonb`;
      case "hasKey":
        return sql`${col} ? ${expr.value as string}`;
      // PostgreSQL 配列
      case "arrayContains":
        return sql`${col} @> ARRAY[${sql.join((expr.value as unknown[]).map(v => sql`${v}`), sql`, `)}]`;
      case "arrayOverlaps":
        return sql`${col} && ARRAY[${sql.join((expr.value as unknown[]).map(v => sql`${v}`), sql`, `)}]`;
    }
  } else if ("and" in expr) {
    return and(...expr.and.map((e) => buildWhere(table, e))) ?? sql`TRUE`;
  } else if ("or" in expr) {
    return or(...expr.or.map((e) => buildWhere(table, e))) ?? sql`FALSE`;
  }
  return sql`TRUE`;
};
