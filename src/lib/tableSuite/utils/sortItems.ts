// src/lib/tableSuite/utils/sortItems.ts

import type { SortState } from "../types";

/**
 * SortState に基づいて配列をソートして新しい配列を返す。
 * sort が未指定の場合は元の配列をそのまま返す（コピーしない）。
 */
export function sortItems<T>(items: T[], sort?: SortState): T[] {
  if (!sort) return items;
  const { field, direction } = sort;
  return [...items].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[field];
    const bVal = (b as Record<string, unknown>)[field];
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
