// 浮く物の外押しとトーストの検査(jsdom の上で開いて押す、当議会 D189)
// - Dialog を開いたままトーストの領域を押しても閉じない(onOpenChange が呼ばれない)、トーストの外を押すと閉じる
// - Popover も同じ(トーストの中の押しは外押しにしない)
// 実行: pnpm test src/components/Primitives/Dialog/Dialog.toast.render.test.tsx
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.Element = dom.window.Element;
g.NodeFilter = dom.window.NodeFilter;
g.MutationObserver = dom.window.MutationObserver;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.FocusEvent = dom.window.FocusEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.PointerEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Dialog: typeof import("./index");
let Popover: typeof import("@/components/Primitives/Popover");
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  Dialog = await import("./index");
  Popover = await import("@/components/Primitives/Popover");
});
after(() => dom.window.close());

/** body の直下にトーストの領域と、外の要素を置く */
function stage() {
  const toast = document.createElement("div");
  toast.setAttribute("data-slot", "toast-region");
  toast.style.pointerEvents = "auto";
  const button = document.createElement("button");
  toast.appendChild(button);
  const outside = document.createElement("button");
  document.body.append(toast, outside);
  return { toastButton: button, outside };
}

const press = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    el.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, cancelable: true, button: 0 }));
    el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
};

test("Dialog: トーストを押しても閉じず、外を押すと閉じる", async () => {
  const { toastButton, outside } = stage();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const calls: boolean[] = [];
  await act(async () => {
    root.render(
      createElement(
        Dialog.DialogPrimitives,
        { open: true, onOpenChange: (v: boolean) => calls.push(v) },
        createElement(Dialog.DialogContent, {}, createElement(Dialog.DialogTitle, {}, "T"), "body"),
      ),
    );
  });
  await new Promise((r) => setTimeout(r, 0));
  await press(toastButton);
  assert.deepEqual(calls, [], "トーストの押しで閉じない");
  await press(outside);
  assert.deepEqual(calls, [false], "外の押しでは閉じる");
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

test("Popover: トーストを押しても閉じず、外を押すと閉じる", async () => {
  const { toastButton, outside } = stage();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const calls: boolean[] = [];
  await act(async () => {
    root.render(
      createElement(
        Popover.PopoverRoot,
        { open: true, onOpenChange: (v: boolean) => calls.push(v) },
        createElement(Popover.PopoverTrigger, {}, "open"),
        createElement(Popover.PopoverContent, {}, "inside"),
      ),
    );
  });
  await new Promise((r) => setTimeout(r, 0));
  await press(toastButton);
  assert.deepEqual(calls, [], "トーストの押しで閉じない");
  await press(outside);
  assert.deepEqual(calls, [false], "外の押しでは閉じる");
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});
