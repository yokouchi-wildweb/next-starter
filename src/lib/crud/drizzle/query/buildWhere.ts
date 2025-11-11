import { and, eq, ne, lt, lte, gt, gte, ilike, or, SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { WhereExpr } from "../../types";

export const buildWhere = (table: PgTable, expr?: WhereExpr): SQL => {
  if (!expr) return sql`TRUE`;
  if ("field" in expr) {
    const col = (table as any)[expr.field];
    switch (expr.op) {
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
      case "like":
        return ilike(col, String(expr.value));
    }
  } else if ("and" in expr) {
    return and(...expr.and.map((e) => buildWhere(table, e))) ?? sql`TRUE`;
  } else if ("or" in expr) {
    return or(...expr.or.map((e) => buildWhere(table, e))) ?? sql`FALSE`;
  }
  return sql`TRUE`;
};
