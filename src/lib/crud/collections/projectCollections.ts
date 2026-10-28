// src/lib/crud/collections/projectCollections.ts
//
// 集まりの読み出しの射影: 主の行に、集まりごとに値の配列を全件（件数の上限なし）並び順で載せる。
// 主のサービス自身の読み出し（applyCollections）と、他ドメインの withRelations で埋め込まれた主の行の両方がこれを使う。
// - 集まり 1 つにつき呼び出し 1 回で 1 クエリ（主の id の IN）。従属が無ければ []
// - 並びは collectionOrderBy（並びの列 ASC NULLS LAST → id ASC、text は COLLATE "C"）

import { inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { collectionOrderBy } from "./collectionOrder";
import { resolveCollectionColumns, type ResolvedCollectionColumns } from "./syncCollection";
import { getTableCollections, hasTableCollections } from "./tableCollections";
import type { CollectionValue, CrudCollectionConfig } from "./types";

type Row = Record<string, unknown>;

/** 宣言ごとの列の解決（表の登録から射影するとき、宣言 1 つにつき 1 回だけ解く） */
const resolvedCache = new WeakMap<CrudCollectionConfig, ResolvedCollectionColumns>();

const resolvedOf = (collection: CrudCollectionConfig): ResolvedCollectionColumns => {
  let resolved = resolvedCache.get(collection);
  if (!resolved) {
    resolved = resolveCollectionColumns(collection);
    resolvedCache.set(collection, resolved);
  }
  return resolved;
};

/**
 * 主の行に集まりの値の配列を載せる（in-place）
 * @param resolved 宣言と同じ順の列の解決（省略時は宣言から解く）
 */
export async function projectCollections(
  records: readonly (Row | null | undefined)[],
  collections: readonly CrudCollectionConfig[],
  resolved?: readonly ResolvedCollectionColumns[],
): Promise<void> {
  const rows = records.filter((record): record is Row => Boolean(record));
  if (!rows.length || !collections.length) return;
  const parentIds = [...new Set(rows.map((record) => record.id as CollectionValue))];
  for (const [index, collection] of collections.entries()) {
    const columns = resolved?.[index] ?? resolvedOf(collection);
    const children = (await db
      .select({ parentId: collection.parentColumn, value: collection.valueColumn })
      .from(columns.childTable as any)
      .where(inArray(collection.parentColumn, parentIds))
      .orderBy(collection.parentColumn, ...collectionOrderBy(collection, columns))) as Row[];
    const valuesByParent = new Map<unknown, CollectionValue[]>();
    for (const child of children) {
      const values = valuesByParent.get(child.parentId);
      if (values) values.push(child.value as CollectionValue);
      else valuesByParent.set(child.parentId, [child.value as CollectionValue]);
    }
    for (const record of rows) {
      record[collection.fieldName] = valuesByParent.get(record.id) ?? [];
    }
  }
}

/**
 * リレーション展開で埋め込んだ行に、その表の集まりを載せる（主の読み出しと同じ規則）。
 * 表に集まりの登録が無ければ何もしない（クエリを増やさない）
 */
export async function projectTableCollections(table: object, records: readonly (Row | null | undefined)[]): Promise<void> {
  if (!hasTableCollections(table) || records.length === 0) return;
  const collections = await getTableCollections(table);
  if (collections?.length) await projectCollections(records, collections);
}
