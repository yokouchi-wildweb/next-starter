// SelectPopover の差し込み header の検査(jsdom の上で開いて読む)。
// - header を渡さない時: 渡す前と同じ出力(差し込みの枠を置かない)。useId の値は描くたびに違うので消して比べる
// - header を渡した時: 見出しと一覧(検索)の間に 1 つの枠で置く。一覧は options のまま
// 実行: pnpm test src/components/Overlays/Popover/SelectPopover.render.test.tsx
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
// RadioGroup(Radix)は描いた後に閉じたフォームを instanceof で見る
g.HTMLFormElement = dom.window.HTMLFormElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.HTMLButtonElement = dom.window.HTMLButtonElement;
g.Node = dom.window.Node;
g.Element = dom.window.Element;
g.NodeFilter = dom.window.NodeFilter;
g.MutationObserver = dom.window.MutationObserver;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.FocusEvent = dom.window.FocusEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SelectPopover: typeof import("./SelectPopover").SelectPopover;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  ({ SelectPopover } = await import("./SelectPopover"));
});
after(() => dom.window.close());

const options = [
  { value: "a", label: "A" },
  { value: "b", label: "B", description: "説明" },
];

/** 開いた SelectPopover を描き、body に portal した中身の HTML(useId の値は消す)を返す */
async function openedHtml(header?: unknown): Promise<string> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(SelectPopover, {
        open: true,
        trigger: createElement("button", { type: "button" }, "open"),
        title: "選ぶ",
        options,
        ...(header === undefined ? {} : { header: header as never }),
      }),
    );
  });
  const content = document.body.querySelector("[data-slot=popover-content]") ?? document.body.querySelector("[role=dialog]");
  const html = (content?.outerHTML ?? "").replace(/«[^»]*»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, "ID");
  await act(async () => root.unmount());
  host.remove();
  return html;
}

test("header を渡さない時は差し込みの枠を置かず、渡した時は見出しと一覧の間に置く", async () => {
  const plain = await openedHtml();
  assert.ok(plain.includes("選ぶ"), "開いた中身を読めている");
  assert.equal(await openedHtml(), plain, "渡さない時の出力は描くたびに同じ");
  assert.equal(await openedHtml(null), plain, "null も渡さないのと同じ");

  const withHeader = await openedHtml(createElement("nav", { "data-test": "tabs" }, "タブ"));
  const tabs = withHeader.indexOf('data-test="tabs"');
  assert.ok(tabs > withHeader.indexOf("選ぶ"), "見出しの後");
  assert.ok(tabs < withHeader.indexOf('role="radiogroup"'), "一覧の前");
  // 差し込みの枠を外すと渡さない時と同じ
  const stripped = withHeader.replace(/<div class="border-b px-3 py-2"><nav data-test="tabs">タブ<\/nav><\/div>/, "");
  assert.equal(stripped, plain);
});
