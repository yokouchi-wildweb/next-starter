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
for (const key of ["window", "document", "HTMLElement", "SVGElement", "Element", "Node", "NodeFilter", "navigator", "getComputedStyle", "DocumentFragment", "MutationObserver", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "FocusEvent", "requestAnimationFrame", "cancelAnimationFrame", "HTMLFormElement", "HTMLInputElement", "HTMLButtonElement", "HTMLSelectElement", "HTMLTextAreaElement", "PointerEvent", "InputEvent"]) {
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
g.IS_REACT_ACT_ENVIRONMENT = true;
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
g.matchMedia = dom.window.matchMedia ?? (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
(dom.window as unknown as { matchMedia: unknown }).matchMedia = g.matchMedia;
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
};
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
  assert.equal(renderToStaticMarkup(h(Badge.BadgeCore, { className: "x" }, "B")), '<span class="x" data-slot="badge">B</span>');
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

// ---- 部品の印が勝つ(呼び手の data-slot は置き換えない): README の一覧の全部の印 ----
// 各部品を開いた状態で描き、全部の部位に呼び手の data-slot="caller" を渡す。一覧の印が全部 DOM に残る(caller に置き換わらない)。
// 要素を描かない部位(Radix の Root / Portal)と、溢れたときだけ出る部位(Select の上下のスクロールのボタン)は DOM に出ないので、
// 並び(印が呼び手の広げより後ろ)を slots.test.mjs の「部品の印が勝つ」が見る。ここではその名前を NOT_IN_DOM に挙げて照合を閉じる
const NOT_IN_DOM = ["dialog", "dialog-portal", "popover", "select", "select-scroll-up-button", "select-scroll-down-button"];
const C = { "data-slot": "caller" } as Record<string, string>;

test("部品の印が勝つ: 呼び手の data-slot を渡しても、README の一覧の印が要素に残る(全 17 部品)", async () => {
  const [{ allPrimitiveSlots }, path] = await Promise.all([import("./slots.mjs"), import("node:path")]);
  const listed = allPrimitiveSlots(path.resolve(__dirname, "../../.."));
  const P = {
    Button: await import("./Button"),
    Calendar: await import("./Calendar"),
    Carousel: await import("./Carousel"),
    Checkbox: await import("./Checkbox"),
    Command: await import("./Command"),
    Dialog: await import("./Dialog"),
    Input: await import("./Input"),
    Label: await import("./Label"),
    Popover: await import("./Popover"),
    RadioGroup: await import("./RadioGroup"),
    Select: await import("./Select"),
    Skeleton: await import("./Skeleton"),
    Tabs: await import("./Tabs"),
  };
  const D = P.Dialog;
  const Po = P.Popover;
  const S = P.Select;
  const Cm = P.Command;
  const Ca = P.Carousel;
  const tree = h("div", null,
    h(Badge.BadgeCore, C, "b"),
    h(Badge.BadgeCore, { ...C, slot: "solid-badge" }, "b"),
    h(Badge.BadgeCore, { ...C, slot: "bookmark-tag-badge" }, "b"),
    h(P.Button.Button, C, "b"),
    h(P.Calendar.Calendar, C),
    h(Ca.Carousel, C, h(Ca.CarouselContent, C, h(Ca.CarouselItem, C, "i")), h(Ca.CarouselPrevious, C), h(Ca.CarouselNext, C)),
    h(P.Checkbox.Checkbox, { ...C, defaultChecked: true }),
    h(Cm.Command, C, h(Cm.CommandInput, C), h(Cm.CommandList, C, h(Cm.CommandEmpty, C, "e"), h(Cm.CommandGroup, { ...C, heading: "g" }, h(Cm.CommandItem, C, "i", h(Cm.CommandShortcut, C, "s"))), h(Cm.CommandSeparator, { ...C, alwaysRender: true }))),
    h(Cm.Command, null, h(Cm.CommandList, null, h(Cm.CommandEmpty, C, "e"))),
    h(P.Input.Input, C),
    h(P.Input.Textarea, C),
    h(P.Label.Label, C, "l"),
    h(P.Label.Label, { ...C, slot: "form-label" }, "l"),
    h(P.RadioGroup.RadioGroup, { ...C, defaultValue: "a" }, h(P.RadioGroup.RadioGroupItem, { ...C, value: "a" })),
    h(P.Skeleton.Skeleton, C),
    h(P.Skeleton.Skeleton, { ...C, slot: "image-viewer-skeleton" }),
    h(P.Tabs.Tabs, { ...C, defaultValue: "a" }, h(P.Tabs.TabsList, C, h(P.Tabs.TabsTrigger, { ...C, value: "a" }, "a")), h(P.Tabs.TabsContent, { ...C, value: "a" }, "c")),
    h(Tip.TooltipProvider, null, h(Tip.TooltipRoot, { open: true }, h(Tip.TooltipTrigger, C, "t"), h(Tip.TooltipPortal, null, h(Tip.TooltipContent, C, "c", h(Tip.TooltipArrow, C))))),
    h(Hover.HoverCardRoot, { open: true }, h(Hover.HoverCardTrigger, C, "t"), h(Hover.HoverCardPortal, null, h(Hover.HoverCardContent, C, "c", h(Hover.HoverCardArrow, C)))),
    h(Po.PopoverRoot, { open: true }, h(Po.PopoverTrigger, C, "t"), h(Po.PopoverAnchor, C), h(Po.PopoverContent, { ...C, showArrow: true } as never,
      h(Po.PopoverHeader, C, h(Po.PopoverTitle, C, "t"), h(Po.PopoverDescription, C, "d")), h(Po.PopoverBody, C, "b"), h(Po.PopoverFooter, C, "f"), h(Po.PopoverClose, C, "x"), h(Po.PopoverArrow, C))),
    h(S.Select, { open: true, defaultValue: "a" }, h(S.SelectTrigger, C, h(S.SelectValue, C)), h(S.SelectContent, { ...C, position: "item-aligned" },
      h(S.SelectGroup, C, h(S.SelectLabel, C, "l"), h(S.SelectItem, { ...C, value: "a" }, "a")), h(S.SelectSeparator, C))),
    h(D.DialogPrimitives, { open: true }, h(D.DialogTrigger, C, "t"), h(D.DialogContent, C, h(D.DialogHeader, C, h(D.DialogTitle, C, "t"), h(D.DialogDescription, C, "d")), h(D.DialogFooter, C, h(D.DialogClose, C, "x")))),
  );
  const view = await mount(tree);
  const html = view.html();
  // 呼び手の props を印の無い内側の要素へ渡す部位(CarouselContent の内側の帯)では caller が残ってよい。印の付く要素で
  // caller に置き換わっていれば、その印が DOM から消えるので下の照合で落ちる
  const inDom = new Set([...html.matchAll(/data-slot="([a-z0-9-]+)"/g)].map((m) => m[1]));
  for (const name of listed) {
    if (NOT_IN_DOM.includes(name)) continue;
    assert.ok(inDom.has(name), `${name} が描いた要素に無い`);
  }
  for (const name of NOT_IN_DOM) assert.ok(listed.includes(name), `NOT_IN_DOM の ${name} は一覧に無い`);
  await view.unmount();
});
