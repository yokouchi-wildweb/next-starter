// 編集画面の項目の移動の候補と表示名のテスト(React 非依存部分)。
// 実行: pnpm test src/lib/crud/hooks/internal/*.test.mjs  （node:test + Node 組み込みの TypeScript type stripping。追加依存なし）
import { test } from "node:test";
import assert from "node:assert/strict";
import { itemLabelOf, withCurrentItem } from "./itemNavigation.ts";

test("今の項目が候補に無ければ先頭に足し、あればそのまま(元の配列は変えない)", () => {
  const items = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(withCurrentItem(items, { id: "c" }).map((i) => i.id), ["c", "a", "b"]);
  assert.deepEqual(withCurrentItem(items, { id: "b" }).map((i) => i.id), ["a", "b"]);
  assert.deepEqual(withCurrentItem(items, undefined).map((i) => i.id), ["a", "b"]);
  assert.deepEqual(items.map((i) => i.id), ["a", "b"]);
});

test("表示名は labelField → name → title → id の順", () => {
  assert.equal(itemLabelOf({ id: "1", code: "X", name: "N" }, "code"), "X");
  assert.equal(itemLabelOf({ id: "1", code: null }, "code"), "");
  assert.equal(itemLabelOf({ id: "1", name: "N", title: "T" }), "N");
  assert.equal(itemLabelOf({ id: "1", name: "", title: "T" }), "T");
  assert.equal(itemLabelOf({ id: "1" }), "1");
});
