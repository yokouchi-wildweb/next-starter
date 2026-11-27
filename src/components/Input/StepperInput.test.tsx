// StepperInput の欄の文字と値の合わせ方の検査(D153): 値が替わった描画で欄の文字が替わる(effect の 1 描画のずれが無い)、
// 制御の値が initialValue と違っても最初の HTML から今の値、打っている途中の「1.50」は値を表している間は保つ。
// 実行: pnpm test src/components/Input/StepperInput.test.tsx
// (tsx。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { JSDOM } from "jsdom";

mock.module("@lib-config/variantOverrides", { defaultExport: {} });

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let StepperInput: typeof import("./StepperInput").default;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  StepperInput = (await import("./StepperInput")).default;
});
after(() => dom.window.close());

test("制御の値が initialValue と違っても、最初の HTML の欄は今の値", () => {
  const html = renderToStaticMarkup(h(StepperInput, { initialValue: 0, value: 5, onValueChange: () => {} }));
  assert.match(html, /value="5"/);
});

test("制御の値を外から替えると、同じ描画で欄の文字が替わる", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const seen: string[] = [];
  // 描画のたびに欄の文字を読む(effect の後でなく、commit の直後)
  const Probe = ({ v }: { v: number }) => h(StepperInput, { value: v, onValueChange: () => {} });
  await act(async () => root.render(h(Probe, { v: 1 })));
  seen.push((host.querySelector("input") as HTMLInputElement).value);
  await act(async () => root.render(h(Probe, { v: 7 })));
  seen.push((host.querySelector("input") as HTMLInputElement).value);
  assert.deepEqual(seen, ["1", "7"]);
  await act(async () => root.unmount());
});

test("打っている途中の「1.50」は値(1.5)を表している間は保つ(「1.5」に書き換えない)", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(h(StepperInput, { initialValue: 0 })));
  const input = host.querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, "1.50");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  assert.equal(input.value, "1.50");
  await act(async () => root.unmount());
  host.remove();
});
