// src/lib/crud/orderBy.ts
//
// 表の並びの状態(tableSuite の SortState)を CRUD の並び順 OrderBySpec に直す。
// 表は並びの状態を見せて変化を伝えるだけで、並べるのは呼び手(一覧を取る側)。その変換なので crud が持つ
// (tableSuite は crud を読まない)。純粋な関数: page.tsx・loader と client の一覧の両方から呼べる。

import type { SortState } from "@/lib/tableSuite";

import type { OrderBySpec } from "./types";

/**
 * SortState を CRUD の OrderBySpec に変換する。
 * 例: { field: "name", direction: "asc" } → [["name", "ASC"]]
 */
export function toOrderBySpec(sort: SortState): OrderBySpec {
  return [[sort.field, sort.direction === "asc" ? "ASC" : "DESC"]];
}
