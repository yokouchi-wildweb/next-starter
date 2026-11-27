// UrlPreviewCard の「コピー済み」を戻すタイマーの検査(D153): 1 本で続けて押すと数え直し、外れた時に止める。
// 実行: pnpm test src/domains/core/purchaseRequest/components/BankTransferInstruction/SaveBookmarkModal/UrlPreviewCard.test.tsx
import { after, before, mock, test } from "node:test";
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
Object.defineProperty(dom.window.navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Part: typeof import("./UrlPreviewCard").UrlPreviewCard;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ UrlPreviewCard: Part } = await import("./UrlPreviewCard"));
});
after(() => dom.window.close());

test("続けて押すと最後の押しから 2 秒で戻る(前のタイマーで早く戻らない)、外れた後は止まる", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(h(Part, { title: "t", url: "https://x/" })));
    const button = () => host.querySelector('button[aria-label="URL をコピー"]') as HTMLButtonElement;
    const click = () => act(async () => { button().click(); });
    await click();
    assert.match(host.textContent ?? "", /コピー済み/);
    await act(async () => mock.timers.tick(1500));
    await click();
    await act(async () => mock.timers.tick(1000));
    assert.match(host.textContent ?? "", /コピー済み/, "最初のタイマーで戻らない");
    await act(async () => mock.timers.tick(1000));
    assert.doesNotMatch(host.textContent ?? "", /コピー済み/, "最後の押しから 2 秒で戻る");
    await click();
    await act(async () => root.unmount());
    await act(async () => mock.timers.tick(5000)); // 外れた後に状態を触らない(止めたので何も起きない)
  } finally {
    mock.timers.reset();
  }
});
