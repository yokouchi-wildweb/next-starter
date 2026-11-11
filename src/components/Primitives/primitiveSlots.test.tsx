// Primitives の新しい印(data-slot)の描画の検査(jsdom の上で描く):
// - BadgeCore: 根の span に badge(クラス・タグは今までどおり)。asChild では子に付き、子が自分の印を持てば子の印が残る
// - Tooltip / HoverCard の薄い部品: 開いた状態で trigger / content / arrow に印が付き、クラスは足さない
// 実行: pnpm test src/components/Primitives/primitiveSlots.test.tsx
// (tsx + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "HTMLElement", "SVGElement", "Element", "Node", "NodeFilter", "navigator", "getComputedStyle", "DocumentFragment", "MutationObserver", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "FocusEvent", "requestAnimationFrame", "cancelAnimationFrame"]) {
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
g.IS_REACT_ACT_ENVIRONMENT = true;
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let Badge: typeof import("./Badge");
let Tip: typeof import("./Tooltip");
let Hover: typeof import("./HoverCard");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  Badge = await import("./Badge");
  Tip = await import("./Tooltip");
  Hover = await import("./HoverCard");
});
after(() => dom.window.close());

test("BadgeCore: 根の span に badge、asChild では子に付き、子の印は子のまま", () => {
  assert.equal(renderToStaticMarkup(h(Badge.BadgeCore, { className: "x" }, "B")), '<span data-slot="badge" class="x">B</span>');
  assert.equal(renderToStaticMarkup(h(Badge.BadgeCore, { asChild: true }, h("a", { href: "/a" }, "A"))), '<a href="/a" data-slot="badge">A</a>');
  assert.equal(renderToStaticMarkup(h(Badge.BadgeCore, { asChild: true }, h("button", { "data-slot": "button" }, "B"))), '<button data-slot="button">B</button>');
});

const mount = async (node: ReturnType<typeof h>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { html: () => document.body.innerHTML, unmount: () => act(async () => root.unmount()) };
};

test("Tooltip の薄い部品: trigger・content・arrow に印、クラスは足さない", async () => {
  const view = await mount(
    h(Tip.TooltipProvider, null,
      h(Tip.TooltipRoot, { open: true },
        h(Tip.TooltipTrigger, null, "T"),
        h(Tip.TooltipPortal, null, h(Tip.TooltipContent, null, "C", h(Tip.TooltipArrow))))),
  );
  const html = view.html();
  for (const slot of ["tooltip-trigger", "tooltip-content", "tooltip-arrow"]) assert.ok(html.includes(`data-slot="${slot}"`), `${slot}: ${html}`);
  assert.ok(!/data-slot="tooltip-content"[^>]*class=/.test(html), "content にクラスを足さない");
  await view.unmount();
});

test("HoverCard の薄い部品: trigger・content・arrow に印、クラスは足さない", async () => {
  const view = await mount(
    h(Hover.HoverCardRoot, { open: true },
      h(Hover.HoverCardTrigger, null, "T"),
      h(Hover.HoverCardPortal, null, h(Hover.HoverCardContent, null, "C", h(Hover.HoverCardArrow)))),
  );
  const html = view.html();
  for (const slot of ["hover-card-trigger", "hover-card-content", "hover-card-arrow"]) assert.ok(html.includes(`data-slot="${slot}"`), `${slot}: ${html}`);
  assert.ok(!/data-slot="hover-card-content"[^>]*class=/.test(html), "content にクラスを足さない");
  await view.unmount();
});
