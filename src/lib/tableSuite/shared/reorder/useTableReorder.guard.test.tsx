// useTableReorder の未保存の守りの結線の検査(jsdom の上でフックを動かす。lib/unsavedGuard は偽物で、渡された値を記録する)。
// - 既定: useUnsavedTasks({ when: true, reason: "unsaved" })、行を落とすと onReorder の戻り値(保存待ちの Promise)を数える
// - guardUnsaved={false}: when: false(守らない)
// 実行: pnpm test:unsaved-guard
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

import type { DragEndEvent } from "@dnd-kit/core";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

const options: Array<{ when?: boolean; reason?: string }> = [];
const tracked: unknown[] = [];
mock.module("@/lib/unsavedGuard", {
  namedExports: {
    useUnsavedTasks: (opts: { when?: boolean; reason?: string }) => {
      options.push(opts);
      return { track: (task: unknown) => (tracked.push(task), task) };
    },
  },
});

type Row = { id: string };
type Reorder = ReturnType<typeof import("./useTableReorder").useTableReorder<Row>>;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useTableReorder: typeof import("./useTableReorder").useTableReorder;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useTableReorder } = await import("./useTableReorder"));
});
after(() => dom.window.close());
beforeEach(() => {
  options.length = 0;
  tracked.length = 0;
});

const items: Row[] = [{ id: "a" }, { id: "b" }];

const mount = async (onReorder: () => void | Promise<unknown>, guardUnsaved?: boolean) => {
  const latest: { reorder?: Reorder } = {};
  const report = (r: Reorder) => {
    latest.reorder = r;
  };
  const Probe = () => {
    const reorder = useTableReorder<Row>({ items, getKey: (row) => row.id, reorderable: { onReorder }, sort: undefined, guardUnsaved });
    useEffect(() => report(reorder));
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  const drop = () => act(async () => latest.reorder?.handleDragEnd({ active: { id: "b" }, over: { id: "a" } } as unknown as DragEndEvent));
  return { drop, unmount: () => act(async () => root.unmount()) };
};

test("既定: 理由「未保存」で守りを掛け、落とした行の onReorder の保存待ち(Promise)を数える", async () => {
  const saving = Promise.resolve();
  const view = await mount(() => saving);
  assert.deepEqual(options.at(-1), { when: true, reason: "unsaved" });
  await view.drop();
  assert.deepEqual(tracked, [saving]);
  await view.unmount();
});

test("guardUnsaved={false}: 守りを掛けない(when: false)", async () => {
  const view = await mount(() => Promise.resolve(), false);
  assert.equal(options.at(-1)?.when, false);
  await view.unmount();
});
