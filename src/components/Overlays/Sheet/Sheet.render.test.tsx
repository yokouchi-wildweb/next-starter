// 辺から出る板 Sheet の検査(jsdom の上で開いて読む・押す)。
// - side ごとに辺に付く class と大きさ(bottom/top = max-height、left/right = 幅)、題が無くても role=dialog に名
// - 背景を押す・ESC・閉じるボタンで onOpenChange(false)
// - className / overlayClassName / layer / overlayLayer / container / slot / overlaySlot
// - side bottom のつまみを下へ引いて閾値を超えて離すと閉じ、超えなければ戻る(bottom 以外・handle={false} はつまみなし)
// 実行: pnpm test src/components/Overlays/Sheet
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
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
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Sheet: typeof import("./Sheet").Sheet;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  Sheet = (await import("./index")).Sheet;
});
after(() => dom.window.close());

const noop = () => {};
const classes = (el: Element | null | undefined) => (el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

/** 開いた形を描き、読む・押すを済ませて片付ける */
function withOpen(el: ReactElement, run: (q: { panel: Element | null; overlay: Element | null }) => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(el));
  run({
    panel: document.querySelector("[role=dialog]"),
    overlay: document.querySelector("[data-slot=sheet-overlay], [data-slot=admin-sidebar]:not([role=dialog])"),
  });
  act(() => root.unmount());
  host.remove();
}

test("side ごとの辺と大きさ、題が無くても名がある", () => {
  withOpen(createElement(Sheet, { open: true, onOpenChange: noop }, "body"), ({ panel }) => {
    const c = classes(panel);
    for (const k of ["fixed", "inset-x-0", "bottom-0", "rounded-t-2xl", "modal-layer"]) assert.ok(c.includes(k), k);
    assert.equal(panel!.getAttribute("data-slot"), "sheet");
    assert.equal(panel!.getAttribute("data-side"), "bottom");
    assert.match(panel!.getAttribute("style") ?? "", /max-height: 85dvh/);
    const labelId = panel!.getAttribute("aria-labelledby");
    assert.equal(document.getElementById(labelId!)?.textContent, "ダイアログ");
    assert.ok(panel!.querySelector("[data-slot=sheet-handle]"), "bottom はつまみが既定で出る");
    assert.ok(panel!.querySelector("[data-slot=sheet-close]"), "閉じるボタン");
    assert.ok(panel!.querySelector(".min-h-0.flex-1.overflow-y-auto"), "本体はスクロールの箱");
  });
  withOpen(
    createElement(Sheet, { open: true, onOpenChange: noop, side: "right", size: 192, title: "T" }, "body"),
    ({ panel }) => {
      const c = classes(panel);
      for (const k of ["inset-y-0", "right-0", "h-full", "border-l"]) assert.ok(c.includes(k), k);
      assert.match(panel!.getAttribute("style") ?? "", /width: 192px/);
      assert.equal(panel!.querySelector("[data-slot=sheet-handle]"), null, "right にはつまみが無い");
      assert.ok(panel!.textContent?.includes("T"));
    },
  );
  withOpen(createElement(Sheet, { open: true, onOpenChange: noop, side: "left", scrollable: false }), ({ panel }) => {
    assert.equal(panel!.querySelector(".overflow-y-auto"), null, "scrollable false は本体を切らない");
    assert.ok(classes(panel).includes("left-0"));
    assert.match(panel!.getAttribute("style") ?? "", /width: 20rem/);
  });
  withOpen(createElement(Sheet, { open: true, onOpenChange: noop, side: "top", size: "50dvh" }), ({ panel }) => {
    assert.ok(classes(panel).includes("top-0") && classes(panel).includes("rounded-b-2xl"));
    assert.match(panel!.getAttribute("style") ?? "", /max-height: 50dvh/);
  });
});

test("背景を押す・ESC・閉じるボタンで onOpenChange(false)", async () => {
  const calls: boolean[] = [];
  const el = createElement(Sheet, { open: true, onOpenChange: (o: boolean) => calls.push(o) }, "body");
  withOpen(el, ({ panel }) => {
    act(() => (panel!.querySelector("[data-slot=sheet-close]") as HTMLElement).click());
  });
  withOpen(el, ({ panel }) => {
    act(() => {
      panel!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
  });
  // 背景を押す: Radix は外の pointerdown の聞き手を次の tick で付けるので待ってから押す
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(el));
  await new Promise((r) => setTimeout(r, 10));
  const overlay = document.querySelector("[data-slot=sheet-overlay]")!;
  act(() => {
    overlay.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, button: 0 }));
  });
  // 左の押下は click まで待って閉じる(Radix の deferred の外の押下)
  act(() => {
    overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  });
  act(() => root.unmount());
  host.remove();
  assert.deepEqual(calls, [false, false, false]);
});

test("className / overlayClassName / 層 / container / 印", () => {
  const box = document.createElement("div");
  document.body.appendChild(box);
  withOpen(
    createElement(Sheet, {
      open: true,
      onOpenChange: noop,
      side: "right",
      className: "md:hidden border-l-0",
      overlayClassName: "md:hidden",
      layer: "navigation",
      overlayLayer: "backdrop",
      container: box,
      slot: "admin-sidebar",
      overlaySlot: "admin-sidebar",
      showCloseButton: false,
    }),
    ({ panel, overlay }) => {
      assert.ok(panel && overlay && box.contains(panel) && box.contains(overlay));
      const c = classes(panel);
      for (const k of ["md:hidden", "border-l-0", "navigation-layer", "absolute"]) assert.ok(c.includes(k), k);
      assert.ok(!c.includes("fixed") && !c.includes("border-l") && !c.includes("modal-layer"));
      const o = classes(overlay);
      for (const k of ["md:hidden", "backdrop-layer", "absolute"]) assert.ok(o.includes(k), k);
      assert.equal(panel!.getAttribute("data-slot"), "admin-sidebar");
      assert.equal(overlay!.getAttribute("data-slot"), "admin-sidebar");
      assert.equal(panel!.querySelector("[data-slot=sheet-close]"), null);
    },
  );
  box.remove();
});

test("つまみを引いて閾値を超えたら閉じ、超えなければ戻る。handle={false} はつまみなし", () => {
  const calls: boolean[] = [];
  const el = createElement(
    Sheet,
    { open: true, onOpenChange: (o: boolean) => calls.push(o), dismissDistance: 100 },
    "body",
  );
  const drag = (handle: Element, to: number) => {
    act(() => {
      handle.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientY: 0 }));
    });
    act(() => {
      handle.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles: true, clientY: to }));
    });
  };
  withOpen(el, ({ panel }) => {
    const handle = panel!.querySelector("[data-slot=sheet-handle]")!;
    drag(handle, 60);
    assert.match(panel!.getAttribute("style") ?? "", /translateY\(60px\)/);
    act(() => {
      handle.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientY: 60 }));
    });
    assert.doesNotMatch(panel!.getAttribute("style") ?? "", /translateY/);
    assert.deepEqual(calls, []);
    drag(handle, 150);
    act(() => {
      handle.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientY: 150 }));
    });
    assert.deepEqual(calls, [false]);
  });
  withOpen(createElement(Sheet, { open: true, onOpenChange: noop, handle: false }), ({ panel }) => {
    assert.equal(panel!.querySelector("[data-slot=sheet-handle]"), null);
  });
});
