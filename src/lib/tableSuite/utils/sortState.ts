// src/lib/tableSuite/utils/sortState.ts

import type { SortDirection, SortState } from "../types";
import type { OrderBySpec } from "@/lib/crud/types";

const SEPARATOR = ".";
const VALID_DIRECTIONS: SortDirection[] = ["asc", "desc"];

/**
 * SortState を URL パラメータ用の文字列にシリアライズする。
 * 例: { field: "name", direction: "asc" } → "name.asc"
 */
export function serializeSortState(sort: SortState): string {
  return `${sort.field}${SEPARATOR}${sort.direction}`;
}

/**
 * URL パラメータ文字列を SortState にパースする。
 * - "name.asc" → { field: "name", direction: "asc" }
 * - "name.desc" → { field: "name", direction: "desc" }
 * - undefined / 不正な値 → undefined
 */
export function parseSortState(value: string | undefined): SortState | undefined {
  if (!value) return undefined;

  const lastDotIndex = value.lastIndexOf(SEPARATOR);
  if (lastDotIndex <= 0) return undefined;

  const field = value.slice(0, lastDotIndex);
  const direction = value.slice(lastDotIndex + 1);

  if (!field || !VALID_DIRECTIONS.includes(direction as SortDirection)) {
    return undefined;
  }

  return { field, direction: direction as SortDirection };
}

/**
 * SortState を CRUD の OrderBySpec に変換する。
 * 例: { field: "name", direction: "asc" } → [["name", "ASC"]]
 */
export function toOrderBySpec(sort: SortState): OrderBySpec {
  return [[sort.field, sort.direction === "asc" ? "ASC" : "DESC"]];
}
