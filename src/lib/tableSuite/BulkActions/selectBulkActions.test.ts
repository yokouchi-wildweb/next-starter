// src/lib/tableSuite/BulkActions/selectBulkActions.test.ts — pnpm test:bulk-actions
// 一括操作の項目を絞って並べる(enabled・lists・access・order・key の重複)
import { test } from "node:test";
import assert from "node:assert/strict";

import { selectBulkActions } from "./selectBulkActions";
import type { BulkActionItem } from "./types";

type Access = { roles: readonly string[] };
const Noop = () => null;
const item = (key: string, extra: Partial<BulkActionItem<unknown, Access>> = {}): BulkActionItem<unknown, Access> => ({ key, Component: Noop, ...extra });
const keys = (items: BulkActionItem<unknown, Access>[]) => items.map((i) => i.key);

test("並び: order の小さい順、同じ(省略 = 100)なら key の順", () => {
  const items = [item("b"), item("a"), item("z", { order: 10 }), item("c", { order: 200 })];
  assert.deepEqual(keys(selectBulkActions(items)), ["z", "a", "b", "c"]);
});

test("enabled: false と false を返す関数は出さない。true・関数の true・省略は出す", () => {
  const items = [item("off", { enabled: false }), item("fnOff", { enabled: () => false }), item("on", { enabled: true }), item("fnOn", { enabled: () => true }), item("plain")];
  assert.deepEqual(keys(selectBulkActions(items)), ["fnOn", "on", "plain"]);
});

test("lists: 容器の一覧の名前を持つ項目だけ。lists の無い項目は全部の一覧。容器が list を渡さなければ lists を持つ項目は出さない", () => {
  const items = [item("all"), item("general", { lists: ["general"] }), item("both", { lists: ["general", "demo"] })];
  assert.deepEqual(keys(selectBulkActions(items, { list: "general" })), ["all", "both", "general"]);
  assert.deepEqual(keys(selectBulkActions(items, { list: "demo" })), ["all", "both"]);
  assert.deepEqual(keys(selectBulkActions(items, { list: "managerial" })), ["all"]);
  assert.deepEqual(keys(selectBulkActions(items)), ["all"]);
});

test("access: can が許す項目だけ。can が無ければ access を持つ項目は出さない(安全側)", () => {
  const items = [item("open"), item("admin", { access: { roles: ["admin"] } }), item("editor", { access: { roles: ["editor"] } })];
  const can = (access: Access) => access.roles.includes("admin");
  assert.deepEqual(keys(selectBulkActions(items, { can })), ["admin", "open"]);
  assert.deepEqual(keys(selectBulkActions(items)), ["open"]);
});

test("key の重複は例外(enabled で外れる項目どうしでも)", () => {
  assert.throws(() => selectBulkActions([item("x"), item("x", { enabled: false })]), /key "x" が重複/);
});

test("元の配列は並べ替えない", () => {
  const items = [item("b"), item("a")];
  selectBulkActions(items);
  assert.deepEqual(keys(items), ["b", "a"]);
});
