// TabbedModal の頭の差し込み(headerContent)の検査(jsdom の上で開いた形を描く)。
// - headerContent を渡さない時: 本体の中身(頭・タブの列・本文・足元)が変更の前に記録した出力(__fixtures__/tabbedModal.before.json)と同じ
// - 渡すと題の下・タブの列の上(本文のスクロールの外)に描かれ、タブを替えても残る
// 実行: pnpm test src/components/Overlays/TabbedModal.render.test.tsx
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
g.requestAnimationFrame = dom.window.requestAnimationFrame;
g.cancelAnimationFrame = dom.window.cancelAnimationFrame;
g.IS_REACT_ACT_ENVIRONMENT = true;

type Snap = {
  overlay: string | null | undefined;
  overlayParentIsBody: boolean;
  content: string | null | undefined;
  contentStyle: string | null | undefined;
  contentInner: string | undefined;
};
const BEFORE = JSON.parse(
  readFileSync(new URL("./__fixtures__/tabbedModal.before.json", import.meta.url), "utf8"),
) as Record<string, string>;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let TM: typeof import("./TabbedModal").default;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  TM = (await import("./TabbedModal")).default;
});
after(() => dom.window.close());

const noop = () => {};
const tabs = [
  { value: "a", label: "A", content: "body-a" },
  { value: "b", label: "B", content: "body-b" },
];

/** 開いた形を描き、本体の中身を読む(read で押す等をしてから片付ける) */
function inner(el: ReactElement, read?: (content: Element) => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(el));
  const content = document.querySelector("[data-slot=dialog-content]")!;
  const out = content.innerHTML.replace(/radix-[^"]+/g, "ID");
  read?.(content);
  act(() => root.unmount());
  host.remove();
  return out;
}

test("headerContent なし: 題あり / 題なし / footer ありの出力が前と同じ", () => {
  assert.equal(inner(createElement(TM, { open: true, onOpenChange: noop, title: "T", tabs })), BEFORE.titled);
  assert.equal(inner(createElement(TM, { open: true, onOpenChange: noop, tabs })), BEFORE.untitled);
  assert.equal(
    inner(createElement(TM, { open: true, onOpenChange: noop, title: "T", tabs, footer: "f" })),
    BEFORE.footer,
  );
});

test("headerContent は題の下・タブの列の上、本文のスクロールの外で、タブを替えても残る", () => {
  const head = createElement("x-head", { id: "h" }, "user");
  const html = inner(
    createElement(TM, { open: true, onOpenChange: noop, title: "T", tabs, headerContent: head }),
    (content) => {
      const header = content.querySelector("[data-slot=dialog-header]")!;
      const kids = [...header.children].map((c) => c.tagName.toLowerCase());
      assert.deepEqual(kids, ["h2", "x-head", "nav"]);
      assert.equal(content.querySelector(".overflow-y-auto x-head"), null);
      const tabB = content.querySelectorAll("[role=tab]")[1] as HTMLElement;
      act(() => {
        tabB.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      assert.equal(content.querySelector("[role=tab][data-state=active]")?.textContent, "B");
      assert.ok(content.querySelector("x-head#h"));
    },
  );
  // headerContent を除けば前と同じ
  assert.equal(html.replace('<x-head id="h">user</x-head>', ""), BEFORE.titled);
});
