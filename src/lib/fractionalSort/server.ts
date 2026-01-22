// src/lib/fractionalSort/server.ts

import { db } from "@/lib/drizzle";
import { eq, gt, asc } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import { generateSortKey, generateFirstSortKey } from "./index";

type SortOrderRecord = { sortOrder: string | null };

/**
 * 非表示レコードを含めた正確な前後を取得して、新しいsortOrderを計算する
 *
 * UIに表示されていないレコードがある場合でも、正しいsortOrderを計算できる。
 *
 * @example
 * ```ts
 * // DをAの直後に移動
 * const newSortOrder = await calculateNewSortOrder(
 *   sampleTable,
 *   sampleTable.sortOrder,
 *   sampleTable.id,
 *   "D", // 移動するアイテム
 *   "A"  // 移動先の直前のアイテム（nullで先頭に移動）
 * );
 * ```
 *
 * @param table - drizzle テーブル
 * @param sortOrderColumn - sortOrderカラム
 * @param idColumn - IDカラム
 * @param itemId - 移動するアイテムのID
 * @param afterItemId - 移動先の直前のアイテムID（nullで先頭に移動）
 * @returns 新しいsortOrder文字列
 */
export async function calculateNewSortOrder<TTable extends PgTable>(
  table: TTable,
  sortOrderColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  itemId: string,
  afterItemId: string | null
): Promise<string> {
  // afterItemId が null の場合、先頭に移動
  if (!afterItemId) {
    // 最も小さい sortOrder を持つレコードを取得
    const firstResults = await db
      .select({ sortOrder: sortOrderColumn })
      .from(table as any)
      .orderBy(asc(sortOrderColumn))
      .limit(1) as SortOrderRecord[];

    const firstSortOrder = firstResults[0]?.sortOrder ?? null;
    return generateFirstSortKey(firstSortOrder);
  }

  // afterItem の sortOrder を取得
  const afterResults = await db
    .select({ sortOrder: sortOrderColumn })
    .from(table as any)
    .where(eq(idColumn, afterItemId))
    .limit(1) as SortOrderRecord[];

  const afterSortOrder = afterResults[0]?.sortOrder ?? null;

  if (!afterSortOrder) {
    // afterItem が見つからない場合は先頭に配置
    return generateFirstSortKey(null);
  }

  // afterItem より大きい sortOrder を持つ最初のレコードを取得（非表示含む全レコード）
  const nextResults = await db
    .select({ sortOrder: sortOrderColumn })
    .from(table as any)
    .where(gt(sortOrderColumn, afterSortOrder))
    .orderBy(asc(sortOrderColumn))
    .limit(1) as SortOrderRecord[];

  const nextSortOrder = nextResults[0]?.sortOrder ?? null;

  return generateSortKey(afterSortOrder, nextSortOrder);
}

/**
 * テーブルの最後に追加するためのsortOrderを計算する
 *
 * @param table - drizzle テーブル
 * @param sortOrderColumn - sortOrderカラム
 * @returns 新しいsortOrder文字列
 */
export async function calculateLastSortOrder<TTable extends PgTable>(
  table: TTable,
  sortOrderColumn: AnyPgColumn
): Promise<string> {
  const results = await db
    .select({ sortOrder: sortOrderColumn })
    .from(table as any)
    .orderBy(asc(sortOrderColumn)) as SortOrderRecord[];

  // 末尾のsortOrderを取得
  const lastSortOrder = results.length > 0
    ? results[results.length - 1]?.sortOrder ?? null
    : null;

  return generateSortKey(lastSortOrder, null);
}

/**
 * 新規レコード作成時のsortOrderを計算する（末尾に追加）
 *
 * @param table - drizzle テーブル
 * @param sortOrderColumn - sortOrderカラム
 * @returns 新しいsortOrder文字列
 */
export const calculateInitialSortOrder = calculateLastSortOrder;
