// src/lib/crud/collections/firstInCollection.ts
//
// 集まりの先頭 1 件（並び順の最初の従属の行）を読む SQL のスカラー副問い合わせ。主の行ごとに 1 値、
// 集まりが空なら NULL。select / where / orderBy にそのまま置け、COALESCE で包める。
// 並びは読み出しの射影と同じ式（collectionOrderBy: text の並びの列は COLLATE "C"）。
// - firstInCollection: 主の id を列オブジェクト（drizzle の表・alias の列）または SQL で渡す形
// - firstInCollectionSql: 主の表の別名を文字列で渡す形（手書きの sql`` / extraWhere / extraOrderBy 用）
// どちらも drizzle の SQL の断片を返す（識別子だけで値の bind は無い）。TS 側の先頭は射影の配列の [0]。

import { getTableName, SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { collectionOrderBy, qualifiedColumn, resolveCollectionOrder, type CollectionColumns } from "./collectionOrder";

export type FirstInCollectionOptions = {
  /** 返す従属の列（省略時は ref 列） */
  select?: AnyPgColumn;
};

export type FirstInCollectionSqlOptions = FirstInCollectionOptions & {
  /** 主の表の id 列の DB 上の名前（省略時は "id"） */
  parentIdColumn?: string;
};

function buildFirst(collection: CollectionColumns, parentId: AnyPgColumn | SQL, options: FirstInCollectionOptions): SQL {
  const resolved = resolveCollectionOrder(collection);
  const selected = options.select ?? collection.refColumn;
  if ((selected as unknown as { table: unknown }).table !== resolved.childTable) {
    throw new Error(`firstInCollection (${getTableName(resolved.childTable)}): select must be a column of the child table.`);
  }
  const parent = parentId instanceof SQL ? parentId : qualifiedColumn(parentId);
  return sql`(select ${qualifiedColumn(selected)} from ${resolved.childTable} where ${qualifiedColumn(
    collection.parentColumn,
  )} = ${parent} order by ${sql.join(
    collectionOrderBy(collection, resolved),
    sql`, `,
  )} limit 1)`;
}

/**
 * 集まりの先頭 1 件の値（既定は ref）。parentId = 主の id 列（e.g. parentTable.id、alias の列）か SQL。
 * e.g. db.select({ id: t.id, cover: firstInCollection(galleryCollection, t.id) }).from(t)
 */
export function firstInCollection(
  collection: CollectionColumns,
  parentId: AnyPgColumn | SQL,
  options: FirstInCollectionOptions = {},
): SQL {
  return buildFirst(collection, parentId, options);
}

/**
 * 主の表の別名を文字列で渡す形。e.g. sql`select p.id, ${firstInCollectionSql(galleryCollection, "p")} as cover from samples p`
 */
export function firstInCollectionSql(
  collection: CollectionColumns,
  parentAlias: string,
  options: FirstInCollectionSqlOptions = {},
): SQL {
  const parentId = sql`${sql.identifier(parentAlias)}.${sql.identifier(options.parentIdColumn ?? "id")}`;
  return buildFirst(collection, parentId, options);
}
