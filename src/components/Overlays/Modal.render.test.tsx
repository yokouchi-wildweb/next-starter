// Modal と土台の DialogContent の出力の検査(jsdom の上で開いた形を描く)。
// - 新しい指定を渡さない時: 背景と本体の class・中身・置き場(body)が変更の前に記録した出力(__fixtures__/modal.before.json)と同じ
// - overlayClassName は背景に足し、本体と背景の層はいつも floating(当議会 D190、層を選ぶ指定は無い)
// - fullscreen: 画面いっぱい(中央寄せ・最大幅・角丸・枠なし、高さ 100dvh、上下に safe-area の余白)。閉じるボタンは内側、本体はスクロールの箱
// - container: その要素の中へ portal し、背景と本体は absolute
// - 管理者コマンドの形(層 super・閉じるボタンなし・sr-only の題・maxHeight null・幅 32rem)が旧の DialogContent の直の使い方と同じ並び
// 実行: pnpm test src/components/Overlays/Modal.render.test.tsx
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

type Snap = {
  overlay: string | null | undefined;
  overlayParentIsBody: boolean;
  content: string | null | undefined;
  contentStyle: string | null | undefined;
  contentInner: string | undefined;
};
const BEFORE = JSON.parse(readFileSync(new URL("./__fixtures__/modal.before.json", import.meta.url), "utf8")) as Record<
  string,
  Snap
>;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Modal: typeof import("./Modal").default;
let P: typeof import("@/components/Primitives/Dialog");
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  Modal = (await import("./Modal")).default;
  P = await import("@/components/Primitives/Dialog");
});
after(() => dom.window.close());

const noop = () => {};

/** 開いた形を描き、背景と本体を読む(読んだら片付ける) */
function snap(el: ReactElement, read?: (content: Element | null, overlay: Element | null) => void): Snap {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(el));
  const overlay = document.querySelector("[data-slot=dialog-overlay]");
  const content = document.querySelector("[data-slot=dialog-content]");
  read?.(content, overlay);
  const out: Snap = {
    overlay: overlay?.getAttribute("class"),
    overlayParentIsBody:
      overlay?.parentElement?.parentElement === document.body || overlay?.parentElement === document.body,
    content: content?.getAttribute("class"),
    contentStyle: content?.getAttribute("style"),
    contentInner: content?.innerHTML.replace(/radix-[^"]+/g, "ID"),
  };
  act(() => root.unmount());
  host.remove();
  return out;
}

const classes = (s: string | null | undefined) => (s ?? "").split(/\s+/).filter(Boolean);

test("新しい指定なし: Modal(既定・maxHeight null・scrollable false)と DialogContent の出力が前と同じ", () => {
  assert.deepEqual(
    snap(createElement(Modal, { open: true, onOpenChange: noop, title: "T" }, "body")),
    BEFORE.modalDefault,
  );
  assert.deepEqual(
    snap(
      createElement(
        Modal,
        { open: true, onOpenChange: noop, maxHeight: null, showCloseButton: false, className: "overflow-hidden p-0" },
        "body",
      ),
    ),
    BEFORE.modalNull,
  );
  assert.deepEqual(
    snap(createElement(Modal, { open: true, onOpenChange: noop, title: "T", scrollable: false, footer: "f" }, "body")),
    BEFORE.modalFixed,
  );
  assert.deepEqual(
    snap(
      createElement(
        P.DialogPrimitives,
        { open: true },
        createElement(
          P.DialogContent,
          { "aria-describedby": undefined },
          createElement(P.DialogTitle, null, "T"),
          "body",
        ),
      ),
    ),
    BEFORE.primitive,
  );
});

test("overlayClassName は背景に足し、層はいつも floating", () => {
  const s = snap(
    createElement(
      Modal,
      {
        open: true,
        onOpenChange: noop,
        overlayClassName: "backdrop-blur-sm",
      },
      "body",
    ),
  );
  // 層は floating だけ(当議会 D189・D190、層を選ぶ指定は無い)
  assert.equal(s.overlay, BEFORE.modalDefault.overlay! + " backdrop-blur-sm");
  assert.equal(classes(s.content).filter((k) => k.endsWith("-layer")).join(" "), "floating-layer");
});

test("fullscreen: 画面いっぱい・上下に safe-area の余白・閉じるボタンは内側・本体はスクロールの箱", () => {
  let wrapper: Element | null | undefined;
  let close: Element | null | undefined;
  const s = snap(
    createElement(Modal, { open: true, onOpenChange: noop, title: "T", fullscreen: true }, "body"),
    (content) => {
      wrapper = content?.querySelector(".overflow-y-auto");
      close = content?.querySelector("[data-slot=dialog-close]");
    },
  );
  const c = classes(s.content);
  for (const k of [
    "fixed",
    "inset-0",
    "top-0",
    "left-0",
    "translate-x-0",
    "translate-y-0",
    "max-w-none",
    "sm:max-w-none",
    "max-h-none",
    "rounded-none",
    "border-0",
    "p-0",
    "pt-[env(safe-area-inset-top)]",
    "pb-[env(safe-area-inset-bottom)]",
    "h-[100dvh]",
  ]) {
    assert.ok(c.includes(k), k);
  }
  for (const k of [
    "top-[50%]",
    "left-[50%]",
    "rounded-lg",
    "border",
    "p-6",
    "max-h-[calc(100dvh-2rem)]",
    "sm:max-w-lg",
  ]) {
    assert.ok(!c.includes(k), k);
  }
  assert.equal(s.contentStyle, "pointer-events: auto;"); // maxWidth の style を付けない
  assert.ok(wrapper, "本体のスクロールの箱");
  assert.ok(classes(wrapper!.getAttribute("class")).includes("flex-1"));
  assert.equal(wrapper!.getAttribute("style"), null); // 高さの上限なし(箱の残りいっぱい)
  assert.ok(close, "閉じるボタン");
  const cc = classes(close!.getAttribute("class"));
  assert.ok(cc.includes("right-3") && cc.includes("translate-y-0") && !cc.includes("-translate-y-1/2"));
  // 中身の余白(呼び手が className で決める)
  const p = snap(createElement(Modal, { open: true, onOpenChange: noop, fullscreen: true, className: "px-4" }, "body"));
  assert.ok(classes(p.content).includes("px-4"));
});

test("container: その要素の中へ portal し、背景と本体は absolute(渡さない時は body)", () => {
  const box = document.createElement("div");
  document.body.appendChild(box);
  let inBox = false;
  const s = snap(
    createElement(Modal, { open: true, onOpenChange: noop, title: "T", container: box }, "body"),
    (content, overlay) => {
      inBox = Boolean(content && overlay && box.contains(content) && box.contains(overlay));
    },
  );
  assert.ok(inBox);
  assert.ok(classes(s.overlay).includes("absolute") && !classes(s.overlay).includes("fixed"));
  assert.ok(classes(s.content).includes("absolute") && !classes(s.content).includes("fixed"));
  const f = snap(createElement(Modal, { open: true, onOpenChange: noop, fullscreen: true, container: box }, "body"));
  assert.ok(classes(f.content).includes("h-full") && !classes(f.content).includes("h-[100dvh]"));
  box.remove();
});

test("管理者コマンドの形: 旧の DialogContent の直の使い方と層・題・中身が同じ(並びは grid → flex-col、幅は style の 32rem)", () => {
  const s = snap(
    createElement(
      Modal,
      {
        open: true,
        onOpenChange: noop,
        title: "管理者コマンド",
        titleSrOnly: true,
        showCloseButton: false,
        className: "overflow-hidden p-0",
        maxWidth: "32rem",
        maxHeight: null,
      },
      "body",
    ),
  );
  const old = BEFORE.palette;
  assert.equal(s.overlay, old.overlay);
  assert.equal(s.overlayParentIsBody, true);
  assert.equal(s.contentInner, old.contentInner);
  assert.equal(s.contentStyle, "max-width: min(32rem, 100% - 2rem); pointer-events: auto;");
  assert.deepEqual(
    classes(s.content).filter((k) => !["flex", "flex-col"].includes(k)),
    classes(old.content).filter((k) => k !== "grid"),
  );
});
