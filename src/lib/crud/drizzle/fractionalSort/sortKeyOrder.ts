// src/lib/crud/drizzle/fractionalSort/sortKeyOrder.ts
//
// fractional の並びの鍵を並べる・比べる式を 1 か所で作る（lib の並びの読み・比較は必ずこれを使う）。
// - text の列（fractional の鍵）は COLLATE "C" を付ける。鍵の生成（fractional-indexing）はバイト順
//   （0-9 < A-Z < a-z）で前後を決めるので、DB や列の照合順序が C でなくても同じ順で読む・比べる
// - integer の列は何も足さない（今までの asc / desc / gt と同じ SQL）

import { asc, desc, gt, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** 並びの列が text（fractional の鍵）か */
export function isTextSortKey(column: AnyPgColumn): boolean {
  return (column as unknown as { dataType: string }).dataType === "string";
}

/**
 * 並びの鍵の式。text の列は `<列> COLLATE "C"`、それ以外は列そのもの。
 * rendered = 列の書き方（表名で修飾した SQL などを渡すとき）
 */
export function sortKeyExpr(column: AnyPgColumn, rendered: AnyPgColumn | SQL = column): AnyPgColumn | SQL {
  return isTextSortKey(column) ? sql`${rendered} collate "C"` : rendered;
}

/** 並びの鍵の昇順 */
export function sortKeyAsc(column: AnyPgColumn): SQL {
  return asc(sortKeyExpr(column));
}

/** 並びの鍵の降順 */
export function sortKeyDesc(column: AnyPgColumn): SQL {
  return desc(sortKeyExpr(column));
}

/** 並びの鍵が value より後ろ */
export function sortKeyGt(column: AnyPgColumn, value: string | number): SQL {
  return isTextSortKey(column) ? sql`${sortKeyExpr(column)} > ${value}` : gt(column, value);
}
