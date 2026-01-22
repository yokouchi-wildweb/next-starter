// src/lib/fractionalSort/index.ts

import { generateKeyBetween } from "fractional-indexing";

/**
 * Fractional Indexing を使ったソート順管理ユーティリティ
 *
 * Figma, Notion, Linear などが採用している方式。
 * 単一レコード更新で済み、番号インフレなし。
 *
 * @example
 * ```ts
 * const first = generateSortKey(null, null);     // "a0"
 * const second = generateSortKey(first, null);   // "a1"
 * const middle = generateSortKey(first, second); // "a0V"
 * ```
 */

/**
 * 2つのソートキーの間に新しいキーを生成
 *
 * @param prev - 直前のアイテムのソートキー（先頭に配置する場合は null）
 * @param next - 直後のアイテムのソートキー（末尾に配置する場合は null）
 * @returns 新しいソートキー
 */
export function generateSortKey(
  prev: string | null,
  next: string | null
): string {
  return generateKeyBetween(prev, next);
}

/**
 * 先頭に配置するためのソートキーを生成
 *
 * @param currentFirst - 現在の先頭アイテムのソートキー（リストが空の場合は null）
 */
export function generateFirstSortKey(currentFirst: string | null): string {
  return generateKeyBetween(null, currentFirst);
}

/**
 * 末尾に配置するためのソートキーを生成
 *
 * @param currentLast - 現在の末尾アイテムのソートキー（リストが空の場合は null）
 */
export function generateLastSortKey(currentLast: string | null): string {
  return generateKeyBetween(currentLast, null);
}

/**
 * 初期ソートキーを生成（リストが空の場合）
 */
export function generateInitialSortKey(): string {
  return generateKeyBetween(null, null);
}

/**
 * 複数アイテムの初期ソートキーを一括生成
 *
 * @param count - 生成するキーの数
 * @returns ソートキーの配列（昇順）
 */
export function generateInitialSortKeys(count: number): string[] {
  if (count <= 0) return [];

  const keys: string[] = [];
  let prev: string | null = null;

  for (let i = 0; i < count; i++) {
    const key = generateKeyBetween(prev, null);
    keys.push(key);
    prev = key;
  }

  return keys;
}
