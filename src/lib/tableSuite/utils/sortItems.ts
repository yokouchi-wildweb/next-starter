// src/lib/tableSuite/utils/sortItems.ts

import type { SortState } from "../types";

export type SortItemsOptions<T> = {
  /**
   * 並べる値の取り出し(未指定 = item[field])。入れ子の値や派生の値で並べるときに渡す
   * 例: (item, field) => field === "hp" ? item.stats.hp : item[field]
   */
  getValue?: (item: T, field: string) => unknown;
  /**
   * null / undefined の位置。未指定 = 昇順で末尾・降順で先頭(比較を反転するため)。
   * "last" / "first" は向きによらず末尾 / 先頭
   */
  nulls?: "last" | "first";
};

/**
 * SortState に基づいて配列をソートして新しい配列を返す。
 * sort が未指定の場合は元の配列をそのまま返す（コピーしない）。
 * options(任意)で値の取り出しと null の位置を変えられる。渡さなければ今の並び
 */
export function sortItems<T>(items: T[], sort?: SortState, options?: SortItemsOptions<T>): T[] {
  if (!sort) return items;
  const { field, direction } = sort;
  const getValue = options?.getValue ?? ((item: T) => (item as Record<string, unknown>)[field]);
  const nulls = options?.nulls;
  return [...items].sort((a, b) => {
    const aVal = getValue(a, field);
    const bVal = getValue(b, field);
    if (nulls && (aVal == null || bVal == null)) {
      if (aVal == null && bVal == null) return 0;
      const nullFirst = nulls === "first" ? -1 : 1;
      return aVal == null ? nullFirst : -nullFirst;
    }
    const cmp = compareValues(aVal, bVal);
    return direction === "desc" ? -cmp : cmp;
  });
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, "ja");
  }

  return String(a).localeCompare(String(b), "ja");
}
