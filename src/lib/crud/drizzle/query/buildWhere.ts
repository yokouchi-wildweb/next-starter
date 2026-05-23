import { and, eq, ne, lt, lte, gt, gte, ilike, isNull, isNotNull, or, SQL, sql, inArray, notInArray } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { WhereExpr } from "@/lib/crud/types";

// HTTP 経由で WhereExpr を受け取る場合、JSON は Date をシリアライズできないため
// value は必ず string で届く。Drizzle の PgTimestamp/PgDate (mode:"date") は
// 比較値として Date オブジェクトを期待するので、ここで補正する。
// 不正文字列は元の値のまま渡し、Drizzle 側の既存エラーで気付けるようにする。
const coerceValue = (col: unknown, value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const dataType = (col as { dataType?: string } | null)?.dataType;
  if (dataType !== "date") return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d;
};

export const buildWhere = (table: PgTable, expr?: WhereExpr): SQL => {
  if (!expr) return sql`TRUE`;
  if ("field" in expr) {
    const col = (table as any)[expr.field];
    switch (expr.op) {
      // 比較
      case "eq":
        return eq(col, coerceValue(col, expr.value) as any);
      case "ne":
        return ne(col, coerceValue(col, expr.value) as any);
      case "lt":
        return lt(col, coerceValue(col, expr.value) as any);
      case "lte":
        return lte(col, coerceValue(col, expr.value) as any);
      case "gt":
        return gt(col, coerceValue(col, expr.value) as any);
      case "gte":
        return gte(col, coerceValue(col, expr.value) as any);
      // テキスト
      case "like":
        return ilike(col, String(expr.value));
      case "startsWith":
        return ilike(col, `${expr.value}%`);
      case "endsWith":
        return ilike(col, `%${expr.value}`);
      // リスト
      case "in":
        return inArray(col, (expr.value as unknown[]).map((v) => coerceValue(col, v)) as any[]);
      case "notIn":
        return notInArray(col, (expr.value as unknown[]).map((v) => coerceValue(col, v)) as any[]);
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
