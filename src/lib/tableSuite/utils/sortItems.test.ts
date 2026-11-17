// sortItems の検査。
// - options を渡さない結果は前と同じ(期待値は options を足す前の関数で作った並び)
// - getValue(入れ子・派生の値)/ nulls("last" / "first" は向きによらない)
// 実行: pnpm test src/lib/tableSuite
import { test } from "node:test";
import assert from "node:assert/strict";

import { sortItems } from "./sortItems";

type Row = { id: string; n?: number | null; s?: string | null; d?: Date | null; b?: boolean | null; stats?: { hp: number | null } };
const rows: Row[] = [
  { id: "a", n: 3, s: "いぬ", d: new Date("2026-01-03"), b: true, stats: { hp: 30 } },
  { id: "b", n: null, s: null, d: null, b: null, stats: { hp: null } },
  { id: "c", n: 1, s: "あり", d: new Date("2026-01-01"), b: false, stats: { hp: 10 } },
  { id: "d", n: 10, s: "うし", d: new Date("2026-01-02"), b: true, stats: { hp: 100 } },
  { id: "e", n: undefined, s: undefined, d: undefined, b: undefined, stats: { hp: 5 } },
  { id: "f", n: 2, s: "B", d: new Date("2025-12-31"), b: false, stats: { hp: 20 } },
];
const ids = (list: Row[]) => list.map((r) => r.id).join("");

test("options なしは前と同じ並び(数・文字・日付・真偽・null 混じり、昇順 / 降順)", () => {
  const before: [string, "asc" | "desc", string][] = [
    ["n", "asc", "cfadbe"],
    ["n", "desc", "ebdafc"],
    ["s", "asc", "fcadbe"],
    ["s", "desc", "ebdacf"],
    ["d", "asc", "fcdabe"],
    ["d", "desc", "ebadcf"],
    ["b", "asc", "cfadbe"],
    ["b", "desc", "ebadcf"],
  ];
  for (const [field, direction, expected] of before) {
    assert.equal(ids(sortItems(rows, { field, direction })), expected, `${field} ${direction}`);
  }
});

test("sort が無ければ同じ配列を返す(コピーしない)", () => {
  assert.equal(sortItems(rows), rows);
  assert.equal(sortItems(rows, undefined, { nulls: "last" }), rows);
});

test("getValue: 入れ子の値で並べる", () => {
  const getValue = (row: Row, field: string) => (field === "hp" ? row.stats?.hp : (row as Record<string, unknown>)[field]);
  assert.equal(ids(sortItems(rows, { field: "hp", direction: "asc" }, { getValue })), "ecfadb");
  assert.equal(ids(sortItems(rows, { field: "hp", direction: "desc" }, { getValue })), "bdafce");
});

test("nulls: last / first は向きによらず末尾 / 先頭、null 以外は向きどおり", () => {
  assert.equal(ids(sortItems(rows, { field: "n", direction: "asc" }, { nulls: "last" })), "cfadbe");
  assert.equal(ids(sortItems(rows, { field: "n", direction: "desc" }, { nulls: "last" })), "dafcbe");
  assert.equal(ids(sortItems(rows, { field: "n", direction: "asc" }, { nulls: "first" })), "becfad");
  assert.equal(ids(sortItems(rows, { field: "n", direction: "desc" }, { nulls: "first" })), "bedafc");
  const getValue = (row: Row) => row.stats?.hp;
  assert.equal(ids(sortItems(rows, { field: "hp", direction: "desc" }, { getValue, nulls: "last" })), "dafceb");
});
