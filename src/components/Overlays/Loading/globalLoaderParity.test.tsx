// 閉じた lib @/lib/globalLoader の GlobalScreenLoader が、棚の ScreenLoader(mode="fullscreen")+ Spinner と
// 同じ見た目(同じ DOM)を出すことの検査。lib は棚を読まない(D103)ので描画を自前で持っており、片方だけ
// 変えるとここで落ちる。jsdom の上で両方を描いて outerHTML を比べる。
// 実行: pnpm test src/components/Overlays/Loading/globalLoaderParity.test.tsx
// (tsx + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h, useEffect } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "HTMLElement", "SVGElement", "Element", "Node", "navigator", "getComputedStyle", "DocumentFragment", "MutationObserver", "Event", "requestAnimationFrame", "cancelAnimationFrame"]) {
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Lib: typeof import("@/lib/globalLoader");
let Shelf: typeof import("./ScreenLoader");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  Lib = await import("@/lib/globalLoader");
  Shelf = await import("./ScreenLoader");
});
after(() => dom.window.close());

type Options = import("@/lib/globalLoader").LoaderOptions;

/** lib の側: showLoader(options) で出した body 直下の要素 */
async function renderLib(options: Options): Promise<string> {
  document.body.innerHTML = "";
  function Driver() {
    const { showLoader, hideLoader } = Lib.useGlobalLoader();
    // 次の場合へ前の表示を持ち越さない(store は 1 つ。持ち越すと属性が後から足されて並びが変わる)
    useEffect(() => {
      showLoader(options);
      return hideLoader;
    }, [showLoader, hideLoader]);
    return h(Lib.GlobalScreenLoader);
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(h(Driver)));
  const el = document.body.querySelector(':scope > [role="status"]');
  assert.ok(el, "GlobalScreenLoader が body 直下に描かれていない");
  const html = el.outerHTML;
  await act(async () => root.unmount());
  return html;
}

/** 棚の側: 今までの GlobalScreenLoader と同じ渡し方(zIndex → style、className はそのまま) */
async function renderShelf(options: Options): Promise<string> {
  document.body.innerHTML = "";
  const { zIndex, className, ...rest } = options;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(h(Shelf.ScreenLoader, { mode: "fullscreen", className, style: zIndex ? { zIndex } : undefined, ...rest })),
  );
  const html = container.firstElementChild?.outerHTML ?? "";
  await act(async () => root.unmount());
  return html;
}

const CASES: [string, Options][] = [
  ["既定", {}],
  ["種類 default", { spinnerVariant: "default" }],
  ["種類 ring", { spinnerVariant: "ring" }],
  ["種類 circle", { spinnerVariant: "circle" }],
  ["文言", { message: "ガチャ準備中…" }],
  ["全部の欄", { message: "処理中", spinnerVariant: "ring", spinnerClassName: "h-6 w-6", messageClassName: "text-xs", className: "bg-overlay/40", zIndex: 100 }],
];

for (const [label, options] of CASES) {
  test(`GlobalScreenLoader は ScreenLoader fullscreen と同じ DOM: ${label}`, async () => {
    const lib = await renderLib(options);
    const shelf = await renderShelf(options);
    assert.ok(shelf.includes('role="status"'));
    assert.equal(lib, shelf);
  });
}

test("hideLoader で消える", async () => {
  document.body.innerHTML = "";
  function Driver({ visible }: { visible: boolean }) {
    const { showLoader, hideLoader } = Lib.useGlobalLoader();
    useEffect(() => {
      if (visible) showLoader("x");
      else hideLoader();
    }, [visible, showLoader, hideLoader]);
    return h(Lib.GlobalScreenLoader);
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(h(Driver, { visible: true })));
  assert.ok(document.body.querySelector('[role="status"]'));
  await act(async () => root.render(h(Driver, { visible: false })));
  assert.equal(document.body.querySelector('[role="status"]'), null);
  await act(async () => root.unmount());
});
