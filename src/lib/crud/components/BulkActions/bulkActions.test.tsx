// src/lib/crud/components/BulkActions/bulkActions.test.tsx — pnpm test src/lib/crud/components/BulkActions/bulkActions.test.tsx
// 作成関数が Bulk*Button に選択の ids・disabled・onSuccess(= onDone)を渡し、BulkActionItems が選択の解除と onDone を呼ぶ
// (tsx + node:test のモジュールモック + react-dom/server の静的描画。ボタンは props を記録する代役に置き換える)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";

type Recorded = { name: string; props: Record<string, unknown> };
const rendered: Recorded[] = [];
const stand = (name: string) => {
  const Stand = (props: Record<string, unknown>) => {
    rendered.push({ name, props });
    return createElement("button", null, name);
  };
  Stand.displayName = name;
  return Stand;
};
mock.module("../Buttons/BulkDeleteButton", { namedExports: { BulkDeleteButton: stand("BulkDeleteButton") } });
mock.module("../Buttons/BulkEnumFieldButton", { namedExports: { BulkEnumFieldButton: stand("BulkEnumFieldButton") } });
mock.module("../Buttons/BulkBelongsToFieldButton", { namedExports: { BulkBelongsToFieldButton: stand("BulkBelongsToFieldButton") } });
mock.module("../Buttons/BulkBelongsToManyFieldButton", { namedExports: { BulkBelongsToManyFieldButton: stand("BulkBelongsToManyFieldButton") } });

let render: (node: ReactNode) => string;
let creators: typeof import("./index");
let BulkActionItems: typeof import("@/lib/tableSuite/BulkActions").BulkActionItems;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  creators = await import("./index");
  ({ BulkActionItems } = await import("@/lib/tableSuite/BulkActions"));
});

const domain = { singular: "x" } as never;
const selectionOf = (ids: string[], clear: () => void = () => {}) => ({
  selectedKeys: ids,
  selectedRows: [],
  selectedIds: ids,
  count: ids.length,
  clear,
});

test("4 つの作成関数: 項目の並べ方の値はそのまま、ボタンには選択の ids と onSuccess(= onDone)を渡す", () => {
  const made = [
    creators.bulkFieldAction({ key: "status", order: 5, lists: ["a"] }, { domain, field: "status" }),
    creators.bulkBelongsToAction({ key: "owner" }, { domain, relation: "owner" }),
    creators.bulkRelationAction({ key: "tags", enabled: false }, { domain, relation: "tag", mode: "add" }),
    creators.bulkDeleteAction({ key: "delete", access: { roles: ["admin"] } }, { domain }),
  ];
  assert.deepEqual(
    made.map(({ key, order, lists, enabled, access }) => ({ key, order, lists, enabled, access })),
    [
      { key: "status", order: 5, lists: ["a"], enabled: undefined, access: undefined },
      { key: "owner", order: undefined, lists: undefined, enabled: undefined, access: undefined },
      { key: "tags", order: undefined, lists: undefined, enabled: false, access: undefined },
      { key: "delete", order: undefined, lists: undefined, enabled: undefined, access: { roles: ["admin"] } },
    ],
  );
  rendered.length = 0;
  const onDone = () => {};
  for (const { Component } of made) render(createElement(Component, { selection: selectionOf(["1", "2"]), onDone }));
  assert.deepEqual(rendered.map((r) => r.name), ["BulkEnumFieldButton", "BulkBelongsToFieldButton", "BulkBelongsToManyFieldButton", "BulkDeleteButton"]);
  for (const r of rendered) {
    assert.deepEqual(r.props.ids, ["1", "2"]);
    assert.equal(r.props.onSuccess, onDone);
    assert.equal(r.props.disabled, false);
    assert.equal(r.props.domain, domain);
  }
  assert.equal(rendered[2].props.mode, "add", "ボタンの options はそのまま渡す");
});

test("選択が 0 件・options.disabled ならボタンを押せない", () => {
  rendered.length = 0;
  const a = creators.bulkDeleteAction({ key: "d" }, { domain });
  const b = creators.bulkDeleteAction({ key: "e" }, { domain, disabled: true });
  render(createElement(a.Component, { selection: selectionOf([]), onDone: () => {} }));
  render(createElement(b.Component, { selection: selectionOf(["1"]), onDone: () => {} }));
  assert.deepEqual(rendered.map((r) => r.props.disabled), [true, true]);
});

test("BulkActionItems: 項目を順に描き、項目の onDone は選択の解除の後に容器の onDone を呼ぶ", () => {
  rendered.length = 0;
  const calls: string[] = [];
  const items = [creators.bulkDeleteAction({ key: "a" }, { domain }), creators.bulkFieldAction({ key: "b" }, { domain, field: "f" })];
  render(createElement(BulkActionItems, { items, selection: selectionOf(["9"], () => calls.push("clear")), onDone: () => calls.push("done") }));
  assert.deepEqual(rendered.map((r) => r.name), ["BulkDeleteButton", "BulkEnumFieldButton"]);
  (rendered[0].props.onSuccess as () => void)();
  assert.deepEqual(calls, ["clear", "done"]);
});
