// useEditableCell の確定の回数の検査(jsdom の上でフックを動かす)。
// Enter は確定してから入力欄の blur を呼び、続く onBlur がもう一度確定する = 同じ編集で handleCommit が 2 回呼ばれる。
// それでも onValidChange(= onCellChange)は 1 回。編集し直せばまた確定する。検証で止まったら確定しない
// 実行: pnpm test:unsaved-guard
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

import type { EditableGridColumn } from "../../../types";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.PointerEvent = dom.window.Event;
g.IS_REACT_ACT_ENVIRONMENT = true;

type Row = { id: string; name: string };
type Cell = ReturnType<typeof import("./useEditableCell").useEditableCell<Row>>;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useEditableCell: typeof import("./useEditableCell").useEditableCell;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useEditableCell } = await import("./useEditableCell"));
});
after(() => dom.window.close());

const mount = async (column: EditableGridColumn<Row>) => {
  const changes: unknown[] = [];
  const latest: { cell?: Cell } = {};
  const report = (cell: Cell) => {
    latest.cell = cell;
  };
  const Probe = () => {
    const cell = useEditableCell<Row>({ row: { id: "1", name: "old" }, rowKey: "1", column, onValidChange: (v) => changes.push(v) });
    useEffect(() => report(cell));
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  const edit = async (draft: string) => {
    await act(async () => latest.cell?.handlers.activateCell({ enterEditMode: true }));
    await act(async () => latest.cell?.handlers.setDraftValue(draft));
  };
  return { changes, latest, edit, unmount: () => act(async () => root.unmount()) };
};

const nameColumn = { field: "name", header: "名前", editorType: "text" } as unknown as EditableGridColumn<Row>;

test("Enter(確定 → blur の確定)でも onValidChange は 1 回。編集し直せばまた 1 回", async () => {
  const view = await mount(nameColumn);
  await view.edit("new");
  // Enter のハンドラと続く onBlur は同じイベントの中で続けて呼ぶ(state は古いまま)
  await act(async () => {
    view.latest.cell?.handlers.handleCommit();
    view.latest.cell?.handlers.handleCommit();
  });
  assert.deepEqual(view.changes, ["new"]);
  assert.equal(view.latest.cell?.state.isEditing, false);

  await view.edit("newer");
  await act(async () => view.latest.cell?.handlers.handleCommit()); // Tab / blur だけ
  assert.deepEqual(view.changes, ["new", "newer"]);
  await view.unmount();
});

test("検証で止まった確定は閉じず確定もしない。直せば 1 回だけ確定する", async () => {
  const strict = { ...nameColumn, validator: (v: unknown) => (String(v).length > 3 ? "長すぎ" : null) } as unknown as EditableGridColumn<Row>;
  const view = await mount(strict);
  await view.edit("toolong");
  await act(async () => {
    view.latest.cell?.handlers.handleCommit();
    view.latest.cell?.handlers.handleCommit();
  });
  assert.deepEqual(view.changes, []);
  assert.equal(view.latest.cell?.state.isEditing, true);
  await act(async () => view.latest.cell?.handlers.setDraftValue("ok"));
  await act(async () => {
    view.latest.cell?.handlers.handleCommit();
    view.latest.cell?.handlers.handleCommit();
  });
  assert.deepEqual(view.changes, ["ok"]);
  await view.unmount();
});
