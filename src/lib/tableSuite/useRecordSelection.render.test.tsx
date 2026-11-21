// 行の選択の状態 useRecordSelection の検査(jsdom + react-dom/client の act で、フックを小さな部品の中で使う)。
// - 指定なし: 個別 / 全部の切り替え・制御 / 非制御・onSelectionChange の rows・isAll / isPartial(前の動きと同じ)
// - canSelect: 選べない行は個別でも全部でも選ばれず、isAllSelected は選べる行だけで数える
// - rangeSelect: shift で起点から今の行まで
// - RecordSelectionTable の出力は前と同じ(06 で記録した出力)、選べない行のチェックは disabled
// 実行: pnpm test src/lib/tableSuite
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement, type Key } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import { RecordSelectionTable, useRecordSelection, type UseRecordSelectionOptions } from "./index";

import { tableDefaultCases } from "./infiniteFooterCases";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "navigator"]) {
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
});
after(() => dom.window.close());

type Row = { id: string; locked?: boolean };
const rows: Row[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, locked: id === "c" }));
const getKey = (r: Row) => r.id;

type Selection = ReturnType<typeof useRecordSelection<Row>>;
async function mount(options: Partial<UseRecordSelectionOptions<Row>>) {
  let current: Selection | null = null;
  const capture = (selection: Selection) => {
    current = selection;
  };
  function Probe(props: Partial<UseRecordSelectionOptions<Row>>) {
    capture(useRecordSelection<Row>({ items: rows, getKey, ...props }));
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(Probe, options)));
  const run = async (fn: (s: Selection) => void) => act(async () => fn(current!));
  const rerender = async (next: Partial<UseRecordSelectionOptions<Row>>) => act(async () => root.render(createElement(Probe, next)));
  return { get s() { return current!; }, run, rerender, unmount: () => act(async () => root.unmount()) };
}

test("指定なし(非制御): 個別 / 全部 / clear と isAll / isPartial、onSelectionChange の rows", async () => {
  const calls: [Key[], Row[]][] = [];
  const h = await mount({ onSelectionChange: (k, r) => calls.push([k, r]) });
  await h.run((s) => s.updateKeySelection("b"));
  assert.deepEqual(h.s.selectedKeys, ["b"]);
  assert.equal(h.s.isPartialSelection, true);
  await h.run((s) => s.updateAllSelection(true));
  assert.deepEqual(h.s.selectedKeys, ["a", "b", "c", "d", "e"]);
  assert.equal(h.s.isAllSelected, true);
  await h.run((s) => s.updateKeySelection("a", false));
  await h.run((s) => s.clear());
  assert.deepEqual(h.s.selectedKeys, []);
  assert.deepEqual(calls.map(([k]) => k), [["b"], ["a", "b", "c", "d", "e"], ["b", "c", "d", "e"], []]);
  assert.deepEqual(calls[0][1], [rows[1]]);
  // shift だけでは範囲にならない(rangeSelect 既定 false)
  await h.run((s) => s.toggle("a"));
  await h.run((s) => s.toggle("d", { shiftKey: true }));
  assert.deepEqual(h.s.selectedKeys, ["a", "d"]);
  await h.unmount();
});

test("制御: selectedKeys を渡すと内部で持たず、onSelectionChange だけ呼ぶ", async () => {
  const calls: Key[][] = [];
  const h = await mount({ selectedKeys: ["a"], onSelectionChange: (k) => calls.push(k) });
  await h.run((s) => s.updateKeySelection("b"));
  assert.deepEqual(h.s.selectedKeys, ["a"]);
  assert.deepEqual([...calls], [["a", "b"]]); // 写しで比べる(deepEqual の型の絞り込みで calls が string[][] にならないように)
  await h.rerender({ selectedKeys: ["a", "b"] as Key[], onSelectionChange: (k: Key[]) => calls.push(k) });
  assert.deepEqual(h.s.bulkSelection.selectedIds, ["a", "b"]);
  assert.equal(h.s.bulkSelection.count, 2);
  await h.unmount();
});

test("canSelect: 選べない行は個別でも全部でも選ばれず、全部は選べる行だけで数える", async () => {
  const h = await mount({ canSelect: (r) => !r.locked });
  await h.run((s) => s.updateKeySelection("c"));
  assert.deepEqual(h.s.selectedKeys, []);
  await h.run((s) => s.toggleAll(true));
  assert.deepEqual(h.s.selectedKeys, ["a", "b", "d", "e"]);
  assert.equal(h.s.isAllSelected, true);
  assert.equal(h.s.isSelectable("c"), false);
  await h.unmount();
});

test("rangeSelect: shift で起点から今の行まで同じ値(選べない行は飛ばす)", async () => {
  const h = await mount({ rangeSelect: true, canSelect: (r) => !r.locked });
  await h.run((s) => s.toggle("a"));
  await h.run((s) => s.toggle("e", { shiftKey: true }));
  assert.deepEqual(h.s.selectedKeys, ["a", "b", "d", "e"]);
  // 外す向き: 起点 e から b まで外す
  await h.run((s) => s.toggle("b", { shiftKey: true }));
  assert.deepEqual(h.s.selectedKeys, ["a"]);
  await h.unmount();
});

const fixtures = JSON.parse(readFileSync("src/lib/tableSuite/__fixtures__/infiniteFooterDefault.json", "utf8")) as Record<string, string>;

test("RecordSelectionTable: 指定なしの出力は前と同じ、canSelectRow の行はチェックが disabled", () => {
  assert.equal(renderToStaticMarkup(tableDefaultCases.selection), fixtures.selection);
  assert.equal(renderToStaticMarkup(tableDefaultCases.selectionSentinel), fixtures.selectionSentinel);
  const out = renderToStaticMarkup(
    createElement(RecordSelectionTable<Row>, {
      items: rows,
      getKey,
      columns: [{ header: "id", render: (r: Row) => r.id }],
      canSelectRow: (r: Row) => !r.locked,
    }),
  );
  const doc = new JSDOM(out).window.document;
  const boxes = [...doc.querySelectorAll('tbody [data-table-checkbox-root="true"]')];
  assert.deepEqual(boxes.map((b) => b.hasAttribute("disabled")), [false, false, true, false, false]);
});

test("RecordSelectionTable: rangeSelect で shift を押した行のクリックが範囲になる", async () => {
  const calls: Key[][] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      createElement(RecordSelectionTable<Row>, {
        items: rows,
        getKey,
        columns: [{ header: "id", render: (r: Row) => r.id }],
        rangeSelect: true,
        canSelectRow: (r: Row) => !r.locked,
        onSelectionChange: (k: Key[]) => calls.push(k),
      }),
    ),
  );
  const bodyRows = [...host.querySelectorAll("tbody tr")];
  await act(async () => {
    bodyRows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    bodyRows[3].dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
  });
  assert.deepEqual(calls, [["a"], ["a", "b", "d"]]);
  await act(async () => root.unmount());
});
