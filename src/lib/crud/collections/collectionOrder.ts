// src/lib/crud/collections/collectionOrder.ts
//
// 集まりの並び順（並びの列 ASC NULLS LAST → id ASC）の式を 1 か所で作る。
// 読み出しの射影・同期の全件読み・先頭 1 件の SQL は必ずこれを使う（並びがずれないように）。
// - 並びの列が text（fractional の鍵）なら COLLATE "C" を付ける。DB や列の照合順序が C でなくても、
//   鍵の生成と同じバイト順（0-9 < A-Z < a-z）で並べるため

import { getTableColumns, getTableName, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { isTextSortKey, sortKeyExpr } from "../drizzle/fractionalSort/sortKeyOrder";
import type { CrudCollectionConfig } from "./types";

/** 並び順を作るのに要る集まりの列（collections の宣言をそのまま渡せる） */
export type CollectionColumns = Pick<CrudCollectionConfig, "parentColumn" | "refColumn" | "sortColumn">;

export type ResolvedCollectionOrder = {
  childTable: PgTable;
  childId: AnyPgColumn;
  /** 並びの列が text（= COLLATE "C" で読む） */
  textSort: boolean;
};

const tableOf = (column: AnyPgColumn): PgTable => (column as unknown as { table: PgTable }).table;

/** 従属の表・id 列・並びの列の型を解決する。id 列が無い・並びの列が text / integer でなければ throw */
export function resolveCollectionOrder(columns: CollectionColumns, label?: string): ResolvedCollectionOrder {
  const childTable = tableOf(columns.parentColumn);
  const name = label ?? `collection (${getTableName(childTable)})`;
  const childId = (getTableColumns(childTable) as Record<string, AnyPgColumn>).id;
  if (!childId) {
    throw new Error(`${name}: the child table must have an id column.`);
  }
  const sortType = (columns.sortColumn as unknown as { dataType: string }).dataType;
  if (sortType !== "string" && sortType !== "number") {
    throw new Error(`${name}: sortColumn must be a text (fractional key) or integer column.`);
  }
  return { childTable, childId, textSort: isTextSortKey(columns.sortColumn) };
}

/**
 * 列を「表名.列名」で書く。drizzle は 1 表の select の項目に置いた SQL の列を表名なしで書くため、
 * 先頭 1 件の副問い合わせを select に置くと主と従属の列が見分けられなくなる（必ず表名を付ける）
 */
export function qualifiedColumn(column: AnyPgColumn): SQL {
  return sql`${sql.identifier(getTableName(tableOf(column)))}.${sql.identifier(column.name)}`;
}

/** 集まりの ORDER BY の式（並びの列 [COLLATE "C"] ASC NULLS LAST, id ASC） */
export function collectionOrderBy(columns: CollectionColumns, resolved: ResolvedCollectionOrder): SQL[] {
  const sort = sortKeyExpr(columns.sortColumn, qualifiedColumn(columns.sortColumn));
  return [sql`${sort} asc nulls last`, sql`${qualifiedColumn(resolved.childId)} asc`];
}
