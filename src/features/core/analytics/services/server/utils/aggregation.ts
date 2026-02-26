// src/features/core/analytics/services/server/utils/aggregation.ts
// 集計ユーティリティ

import { formatDateKeyTz } from "./dateRange";
import { DEFAULT_TIMEZONE } from "@/features/core/analytics/constants";

/**
 * レコード配列を日付キーでグルーピングする
 *
 * @param records - グルーピング対象のレコード配列
 * @param getDate - 各レコードから日付を取得する関数
 * @param timezone - タイムゾーン（デフォルト: DEFAULT_TIMEZONE）
 * @returns Map<YYYY-MM-DD, T[]>
 */
export function groupByDate<T>(
  records: T[],
  getDate: (record: T) => Date | null,
  timezone?: string,
): Map<string, T[]> {
  const tz = timezone ?? DEFAULT_TIMEZONE;
  const map = new Map<string, T[]>();

  for (const record of records) {
    const date = getDate(record);
    if (!date) continue;
    const key = formatDateKeyTz(date, tz);
    const group = map.get(key);
    if (group) {
      group.push(record);
    } else {
      map.set(key, [record]);
    }
  }

  return map;
}

/**
 * ユニークな値の数をカウントする
 *
 * @param records - 対象レコード配列
 * @param getValue - 各レコードからカウント対象の値を取得する関数
 */
export function countUnique<T>(
  records: T[],
  getValue: (record: T) => string,
): number {
  const set = new Set<string>();
  for (const record of records) {
    set.add(getValue(record));
  }
  return set.size;
}

/**
 * レコード配列を指定キーでグルーピングする（汎用版）
 *
 * @param records - グルーピング対象のレコード配列
 * @param getKey - 各レコードからグルーピングキーを取得する関数
 * @returns Map<string, T[]>
 */
export function groupBy<T>(
  records: T[],
  getKey: (record: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const record of records) {
    const key = getKey(record);
    const group = map.get(key);
    if (group) {
      group.push(record);
    } else {
      map.set(key, [record]);
    }
  }

  return map;
}

/**
 * 数値配列の合計
 */
export function sum(values: number[]): number {
  let total = 0;
  for (const v of values) {
    total += v;
  }
  return total;
}

/**
 * 数値配列の中央値
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * 変化率を計算する（0除算対応）
 */
export function changeRate(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}
