// Popover の描く先の検査(jsdom の上で開いて読む)。
// - 浮く物は全部 body へ portal して floating(当議会 D189・D190): Dialog の中で開いても本体の中ではなく body の直下に描き、
//   層の class は floating-layer だけ
// 実行: pnpm test src/components/Primitives/Popover/Popover.render.test.tsx
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
g.getComputedStyle = dom.window.getComputedStyle;
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Popover: typeof import("./index");
let Dialog: typeof import("@/components/Primitives/Dialog");
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  Popover = await import("./index");
  Dialog = await import("@/components/Primitives/Dialog");
});
after(() => dom.window.close());

test("Dialog の中で開いた Popover は body の直下へ portal し、層は floating だけ", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        Dialog.DialogPrimitives,
        { open: true },
        createElement(
          Dialog.DialogContent,
          {},
          createElement(Dialog.DialogTitle, {}, "T"),
          createElement(
            Popover.PopoverRoot,
            { open: true },
            createElement(Popover.PopoverTrigger, {}, "open"),
            createElement(Popover.PopoverContent, {}, "inside"),
          ),
        ),
      ),
    );
  });
  const content = document.querySelector('[data-slot="popover-content"]');
  assert.ok(content, "popover-content が描かれる");
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog && !dialog.contains(content), "Dialog の本体の中に描かない");
  const layers = (content!.getAttribute("class") ?? "").split(/\s+/).filter((k) => k.endsWith("-layer"));
  assert.deepEqual(layers, ["floating-layer"]);
  await act(async () => root.unmount());
});
