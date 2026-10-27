// src/lib/crud/collections/syncCollection.ts
//
// 集まりの差分同期の単独関数。createCrudService の collections オプションはこれを呼ぶ。
// base を通らない書き込み（手書きのドメイン・fork の独自の保存）からも同じ規則で同期できる。
// - 主の行を FOR UPDATE でロック → 従属の行を件数の上限なしで全部読む →値の列の値で差分
// - 変わらない値の行は残す（子の id を保つ）/ 消えた値の行は従属の hardDelete / 新しい値は従属の create
// - 並びは同期のたびに配列順に振り直し、従属の systemUpdate で書く（作った行と、並びの値が変わった行）。
//   text の列は lib の fractional の鍵（replaceByQuery の sortOrderFromIndex と同じ generateInitialSortKeys）、
//   integer の列は 0 始まりの添字
// - 読んでいない行は消さない（ロックしてから読み直すので、直接の書き込みとは主の保存が後勝ち）

import { eq, getTableColumns, getTableName } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/drizzle";
import { generateInitialSortKeys } from "../drizzle/fractionalSort";
import { DomainError } from "@/lib/errors";

import type { DbTransaction } from "../drizzle/types";
import { collectionOrderBy, resolveCollectionOrder, type ResolvedCollectionOrder } from "./collectionOrder";
import type {
  CollectionValue,
  CollectionSyncResult,
  CrudCollectionChildService,
  CrudCollectionConfig,
} from "./types";

type Row = Record<string, unknown>;

export type SyncCollectionParams = {
  /** 主の表 */
  parentTable: PgTable & { id: AnyPgColumn };
  /** 主の行の id */
  parentId: string | number;
  /** 集まりの宣言 */
  collection: CrudCollectionConfig;
  /** 同期後の値の並び（重複・最大件数の超過は 400） */
  values: readonly unknown[];
};

export type ResolvedCollectionColumns = ResolvedCollectionOrder & {
  parentProp: string;
  valueProp: string;
  sortProp: string;
  /** 配列の長さから並びの値の列を作る（text = fractional の鍵、integer = 添字） */
  sortValues: (count: number) => Array<string | number>;
};

/**
 * 集まりの宣言の列を解決し、宣言の誤りを throw する（サービス生成時に呼ぶ）。
 * - 主への参照列・値の列・並びの列は同じ従属の表のもの、従属の表は id 列を持つ
 * - 論理削除の従属は扱わない（deletedAt / deleted_at 列を持つ表は拒否）
 */
export function resolveCollectionColumns(collection: CrudCollectionConfig): ResolvedCollectionColumns {
  const label = `collections "${collection.fieldName}" (${getTableName(
    (collection.parentColumn as unknown as { table: PgTable }).table,
  )})`;
  const order = resolveCollectionOrder(collection, label);
  const columns = getTableColumns(order.childTable) as Record<string, AnyPgColumn>;
  const propOf = (column: AnyPgColumn, role: string): string => {
    const entry = Object.entries(columns).find(([, value]) => value === column);
    if (!entry) {
      throw new Error(`${label}: ${role} must be a column of the same child table as parentColumn.`);
    }
    return entry[0];
  };
  if (Object.entries(columns).some(([key, value]) => key === "deletedAt" || value.name === "deleted_at")) {
    throw new Error(`${label}: a soft-delete child table (deletedAt) is not supported.`);
  }
  if (collection.maxItems !== undefined && (!Number.isInteger(collection.maxItems) || collection.maxItems < 1)) {
    throw new Error(`${label}: maxItems must be a positive integer.`);
  }
  const sortValues = order.textSort
    ? (count: number) => generateInitialSortKeys(count)
    : (count: number) => Array.from({ length: count }, (_, index) => index);
  const resolved = {
    ...order,
    parentProp: propOf(collection.parentColumn, "parentColumn"),
    valueProp: propOf(collection.valueColumn, "valueColumn"),
    sortProp: propOf(collection.sortColumn, "sortColumn"),
    sortValues,
  };
  if (new Set([resolved.parentProp, resolved.valueProp, resolved.sortProp, "id"]).size !== 4) {
    throw new Error(`${label}: parentColumn, valueColumn, sortColumn and id must be different columns.`);
  }
  return resolved;
}

/**
 * 集まりの入力値を検査して値の配列にする（DB に触れる前に呼ぶ）。
 * 配列でない・要素が空・重複・最大件数の超過は DomainError 400。
 */
export function validateCollectionValues(collection: CrudCollectionConfig, value: unknown): CollectionValue[] {
  const field = collection.fieldName;
  if (!Array.isArray(value)) {
    throw new DomainError(`${field} は配列で指定してください`, { status: 400 });
  }
  const seen = new Set<CollectionValue>();
  for (const item of value) {
    const valid =
      (typeof item === "string" && item.length > 0) || (typeof item === "number" && Number.isFinite(item));
    if (!valid) {
      throw new DomainError(`${field} の要素が不正です`, { status: 400 });
    }
    if (seen.has(item)) {
      throw new DomainError(`${field} に同じ値が重複しています`, { status: 400 });
    }
    seen.add(item);
  }
  if (collection.maxItems !== undefined && value.length > collection.maxItems) {
    throw new DomainError(`${field} は ${collection.maxItems} 件までです`, { status: 400 });
  }
  return value as CollectionValue[];
}

/**
 * 従属の 1 行の並びの値を systemUpdate で書く（同期と複製の共通部）。
 * 従属の systemColumns に並びの列が無ければ、分かるエラー（500）にする
 */
export async function writeCollectionSort(
  executor: DbTransaction,
  child: CrudCollectionChildService,
  collection: CrudCollectionConfig,
  resolved: ResolvedCollectionColumns,
  row: Row,
  sort: string | number,
): Promise<Row> {
  try {
    return (await child.systemUpdate(String(row.id), { [resolved.sortProp]: sort }, executor)) as Row;
  } catch (error) {
    if (error instanceof DomainError && error.message.includes("systemColumns")) {
      throw new DomainError(
        `collections "${collection.fieldName}": 従属のサービス（${getTableName(resolved.childTable)}）の systemColumns に並びの列 "${resolved.sortProp}" を宣言してください`,
        { status: 500 },
      );
    }
    throw error;
  }
}

/** 検査済みの値で、渡された TX の中で同期する（applyCollections と syncCollection の共通部） */
export async function syncCollectionInTx(
  executor: DbTransaction,
  params: Omit<SyncCollectionParams, "values"> & { values: readonly CollectionValue[] },
  resolved: ResolvedCollectionColumns = resolveCollectionColumns(params.collection),
): Promise<CollectionSyncResult> {
  const { parentTable, parentId, collection, values } = params;
  const { childTable, parentProp, valueProp, sortProp, sortValues } = resolved;

  const locked = await executor
    .select({ id: parentTable.id })
    .from(parentTable as any)
    .where(eq(parentTable.id, parentId))
    .for("update");
  if (!locked.length) {
    throw new DomainError("集まりを同期する主の行が見つかりません", { status: 404 });
  }

  const child = await collection.service();
  // 件数の上限なしで全部読む（読んでいない行を消さないため）。並びは読み出しの射影と同じ式（text は COLLATE "C"）
  const existing = (await executor
    .select()
    .from(childTable as any)
    .where(eq(collection.parentColumn, parentId))
    .orderBy(...collectionOrderBy(collection, resolved))) as Row[];

  const wanted = new Set<CollectionValue>(values);
  const kept = new Map<CollectionValue, Row>();
  const toDelete: Row[] = [];
  for (const row of existing) {
    const value = row[valueProp] as CollectionValue;
    // 直接の書き込みで同じ値の行が複数あれば、並びの先の 1 行だけを残す
    if (wanted.has(value) && !kept.has(value)) kept.set(value, row);
    else toDelete.push(row);
  }

  for (const row of toDelete) {
    await child.hardDelete(String(row.id), executor);
  }

  const writeSort = (row: Row, sort: string | number) =>
    writeCollectionSort(executor, child, collection, resolved, row, sort);

  // 親の中の並びを配列順に振り直す（値が同じ行は書かない）
  const sorts = sortValues(values.length);
  const rows: Row[] = [];
  let created = 0;
  for (const [index, value] of values.entries()) {
    const sort = sorts[index];
    const current = kept.get(value);
    if (current) {
      rows.push(current[sortProp] === sort ? current : await writeSort(current, sort));
      continue;
    }
    // 並びは create の入力にも入れる（NOT NULL の列のため）が、従属の parseCreate が落とすことがあるので
    // 作った行は必ず systemUpdate で書く（systemColumns の宣言漏れを最初の追加で分かるようにする）
    const inserted = (await child.create(
      { [parentProp]: parentId, [valueProp]: value, [sortProp]: sort },
      executor,
    )) as Row;
    created += 1;
    rows.push(await writeSort(inserted, sort));
  }

  return { rows, created, deleted: toDelete.length };
}

/**
 * 主の 1 行の集まりを values の並びに差分同期する。tx を渡さなければ内部で TX を張る。
 * 主の行が無ければ 404。
 */
export async function syncCollection(
  params: SyncCollectionParams,
  tx?: DbTransaction,
): Promise<CollectionSyncResult> {
  const values = validateCollectionValues(params.collection, params.values);
  const resolved = resolveCollectionColumns(params.collection);
  const input = { ...params, values };
  if (tx) return syncCollectionInTx(tx, input, resolved);
  return db.transaction((innerTx) => syncCollectionInTx(innerTx, input, resolved));
}
