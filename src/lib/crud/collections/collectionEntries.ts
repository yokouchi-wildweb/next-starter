// src/lib/crud/collections/collectionEntries.ts
//
// 集まりを「id 付きのエントリ」として読む・値から従属の行 id を引く単独関数。
// 集まりの 1 件を他の表から FK（従属の行 id）で参照する用途（主の集まりの中から 1 件を選ぶ等）。
// 主の get / search が載せる値の配列（フォームが送る形）は変えず、エントリは呼んだときだけ返す。
// - エントリ = { id, value, sort }。並びは読み出しの射影と同じ（collectionOrderBy）。1 回の呼び出しで 1 クエリ（主の id の IN）
// - 従属の表が値・並びの列を秘匿列（defineHiddenColumns）にしていれば null にする
// - 主の表を渡すと、論理削除された主のエントリは返さない（主の表と結合する。クエリは 1 本のまま）

import { and, eq, getTableColumns, inArray, isNull } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/drizzle";

import { getHiddenColumnProps } from "../drizzle/hiddenColumns";
import type { DbTransaction } from "../drizzle/types";
import { collectionOrderBy } from "./collectionOrder";
import { resolveCollectionColumns } from "./syncCollection";
import type { CollectionValue, CrudCollectionConfig } from "./types";

/** 集まりの 1 要素と、その従属の行 id */
export type CollectionEntry = {
  /** 従属の行 id（FK で参照する値） */
  id: string | number;
  /** 集まりの値（値の列。主の値の配列の要素と同じ） */
  value: CollectionValue | null;
  /** 並びの列の値 */
  sort: string | number | null;
};

export type CollectionEntriesParams = {
  collection: CrudCollectionConfig;
  /** 主の表（渡すと、論理削除された主のエントリを返さない） */
  parentTable?: PgTable & { id: AnyPgColumn };
};

type Row = Record<string, unknown>;

/** 主の表の論理削除の列（無ければ undefined） */
const deletedAtOf = (table?: PgTable): AnyPgColumn | undefined => {
  if (!table) return undefined;
  const columns = getTableColumns(table) as Record<string, AnyPgColumn>;
  return columns.deletedAt ?? Object.values(columns).find((column) => column.name === "deleted_at");
};

/**
 * 複数の主の集まりをエントリで読む（1 クエリ）。主の id → エントリの並び。従属が無い主は []
 */
export async function collectionEntriesForParents(
  params: CollectionEntriesParams & { parentIds: readonly (string | number)[] },
  tx?: DbTransaction,
): Promise<Map<string | number, CollectionEntry[]>> {
  const { collection, parentTable } = params;
  const parentIds = [...new Set(params.parentIds)];
  const result = new Map<string | number, CollectionEntry[]>(parentIds.map((id) => [id, []]));
  if (!parentIds.length) return result;

  const resolved = resolveCollectionColumns(collection);
  const executor = tx ?? db;
  const deletedAt = deletedAtOf(parentTable);
  const select = { parentId: collection.parentColumn, id: resolved.childId, value: collection.valueColumn, sort: collection.sortColumn };
  let query: any = executor.select(select).from(resolved.childTable as any);
  if (parentTable && deletedAt) {
    query = query.innerJoin(parentTable, and(eq(parentTable.id, collection.parentColumn), isNull(deletedAt)));
  }
  const rows = (await query
    .where(inArray(collection.parentColumn, parentIds))
    .orderBy(collection.parentColumn, ...collectionOrderBy(collection, resolved))) as Row[];

  const hidden = getHiddenColumnProps(resolved.childTable);
  for (const row of rows) {
    const entries = result.get(row.parentId as string | number);
    if (!entries) continue;
    entries.push({
      id: row.id as string | number,
      value: hidden?.has(resolved.valueProp) ? null : (row.value as CollectionValue),
      sort: hidden?.has(resolved.sortProp) ? null : (row.sort as string | number | null),
    });
  }
  return result;
}

/** 1 つの主の集まりをエントリで読む（1 クエリ） */
export async function collectionEntries(
  params: CollectionEntriesParams & { parentId: string | number },
  tx?: DbTransaction,
): Promise<CollectionEntry[]> {
  const entries = await collectionEntriesForParents({ ...params, parentIds: [params.parentId] }, tx);
  return entries.get(params.parentId) ?? [];
}

/**
 * 主の集まりの値から従属の行 id を複数引く（1 クエリ）。その主の集まりに無い値（他の主の値を含む）は Map に入らない。
 * 書き込みで「選んだ 1 件がその主の集まりの要素か」を確かめて id を保存する用途。呼び出し元の tx の中で使える
 */
export async function resolveCollectionEntryIds(
  params: { collection: CrudCollectionConfig; parentId: string | number; values: readonly CollectionValue[] },
  tx?: DbTransaction,
): Promise<Map<CollectionValue, string | number>> {
  const { collection, parentId } = params;
  const values = [...new Set(params.values)];
  const found = new Map<CollectionValue, string | number>();
  if (!values.length) return found;
  const resolved = resolveCollectionColumns(collection);
  const rows = (await (tx ?? db)
    .select({ id: resolved.childId, value: collection.valueColumn })
    .from(resolved.childTable as any)
    .where(and(eq(collection.parentColumn, parentId), inArray(collection.valueColumn, values)))
    .orderBy(...collectionOrderBy(collection, resolved))) as Row[];
  for (const row of rows) {
    // 直接の書き込みで同じ値が複数あれば、並びの先の 1 行（同期が残す行と同じ）
    if (!found.has(row.value as CollectionValue)) found.set(row.value as CollectionValue, row.id as string | number);
  }
  return found;
}

/** 主の集まりの値から従属の行 id を引く（1 クエリ）。その主の集まりに無ければ null */
export async function resolveCollectionEntryId(
  params: { collection: CrudCollectionConfig; parentId: string | number; value: CollectionValue },
  tx?: DbTransaction,
): Promise<string | number | null> {
  const found = await resolveCollectionEntryIds({ ...params, values: [params.value] }, tx);
  return found.get(params.value) ?? null;
}
