// ControlledFileInput の initialUrl の検査(D153): initialUrl を field に入れるのは initialUrl が替わった時だけ。
// 親の描き直しで field が作り直されても、選んだファイルを initialUrl で上書きしない。
// 実行: pnpm test src/lib/formSuite/inputs/FileInput.test.tsx
// (tsx。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let ControlledFileInput: typeof import("./FileInput").ControlledFileInput;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ ControlledFileInput } = await import("./FileInput"));
});
after(() => dom.window.close());

test("field が作り直されても initialUrl で上書きしない、initialUrl が替われば入れる", async () => {
  const calls: unknown[] = [];
  /** 親の描き直しのたびに新しい field(react-hook-form の Controller と同じ) */
  const fieldOf = (value: unknown) =>
    ({ name: "f", value, onChange: (v: unknown) => calls.push(v), onBlur: () => {}, ref: () => {}, disabled: false }) as never;
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(h(ControlledFileInput, { field: fieldOf(null), initialUrl: "https://x/a.png" })));
  assert.deepEqual(calls, ["https://x/a.png"]);
  // 利用者がファイルを選んだ後の親の描き直し(field は新しいオブジェクト、initialUrl は同じ)
  await act(async () => root.render(h(ControlledFileInput, { field: fieldOf({ name: "mine.png" }), initialUrl: "https://x/a.png" })));
  assert.deepEqual(calls, ["https://x/a.png"], "選んだファイルを上書きしない");
  await act(async () => root.render(h(ControlledFileInput, { field: fieldOf({ name: "mine.png" }), initialUrl: "https://x/b.png" })));
  assert.deepEqual(calls, ["https://x/a.png", "https://x/b.png"]);
  await act(async () => root.unmount());
});
