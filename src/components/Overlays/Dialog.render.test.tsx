// Dialog の出力と 3 つ目の行動の検査(jsdom の上で開いた形を描く)。
// - 新しい指定を渡さない時: 背景と本体の class・中身・置き場(body)が変更の前に記録した出力(__fixtures__/dialog.before.json)と同じ
// - className は本体に、overlayClassName は背景に足し、container の中へ absolute で重なる。fullscreen は Modal と同じ全画面
// - extraAction: 取り消しと確定の間に出て、押すと onClick だけ。Promise の間は全部のボタンが止まり、押した方だけ「処理中...」
// 実行: pnpm test src/components/Overlays/Dialog.render.test.tsx
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
const BEFORE = JSON.parse(
  readFileSync(new URL("./__fixtures__/dialog.before.json", import.meta.url), "utf8"),
) as Record<string, Snap>;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let D: typeof import("./Dialog").Dialog;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  D = (await import("./Dialog")).Dialog;
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

const confirmProps = {
  open: true,
  onOpenChange: noop,
  title: "削除",
  description: "消しますか",
  confirmLabel: "削除",
  cancelLabel: "やめる",
  onConfirm: noop,
  confirmVariant: "destructive" as const,
};

test("新しい指定なし: 確認型・OK だけ・children 付き・✕ だけの出力が前と同じ", () => {
  assert.deepEqual(snap(createElement(D, confirmProps)), BEFORE.confirm);
  assert.deepEqual(
    snap(
      createElement(D, {
        open: true,
        onOpenChange: noop,
        title: "完了",
        titleAlign: "center",
        description: "済",
        showCancelButton: false,
        footerAlign: "center",
      }),
    ),
    BEFORE.okOnly,
  );
  assert.deepEqual(
    snap(
      createElement(D, { open: true, onOpenChange: noop, title: "T" }, "body"),
    ),
    BEFORE.children,
  );
  assert.deepEqual(
    snap(
      createElement(
        D,
        { open: true, onOpenChange: noop, showCloseButton: true, showCancelButton: false, showConfirmButton: false },
        "body",
      ),
    ),
    BEFORE.closeOnly,
  );
});

test("className は本体・overlayClassName は背景に足し、container の中へ absolute で重なる", () => {
  const s = snap(createElement(D, { ...confirmProps, className: "bg-card", overlayClassName: "backdrop-blur-sm" }));
  assert.equal(s.overlay, BEFORE.confirm.overlay + " backdrop-blur-sm");
  assert.ok(classes(s.content).includes("bg-card") && !classes(s.content).includes("bg-background"));
  const box = document.createElement("div");
  document.body.appendChild(box);
  let inBox = false;
  const c = snap(createElement(D, { ...confirmProps, container: box }), (content, overlay) => {
    inBox = Boolean(content && overlay && box.contains(content) && box.contains(overlay));
  });
  assert.ok(inBox);
  assert.ok(classes(c.overlay).includes("absolute") && !classes(c.overlay).includes("fixed"));
  assert.ok(classes(c.content).includes("absolute") && !classes(c.content).includes("fixed"));
  box.remove();
});

test("fullscreen: Modal と同じ全画面の class、閉じるボタンは内側", () => {
  let close: Element | null | undefined;
  const s = snap(createElement(D, { ...confirmProps, fullscreen: true, showCloseButton: true }), (content) => {
    close = content?.querySelector("[data-slot=dialog-close]");
  });
  const c = classes(s.content);
  for (const k of [
    "inset-0",
    "max-w-none",
    "rounded-none",
    "border-0",
    "p-0",
    "pt-[env(safe-area-inset-top)]",
    "pb-[env(safe-area-inset-bottom)]",
    "h-[100dvh]",
  ]) {
    assert.ok(c.includes(k), k);
  }
  for (const k of ["top-[50%]", "rounded-lg", "p-6", "max-h-[calc(100dvh-2rem)]"]) assert.ok(!c.includes(k), k);
  const cc = classes(close!.getAttribute("class"));
  assert.ok(cc.includes("right-3") && !cc.includes("-translate-y-1/2"));
});

test("extraAction: 取り消しと確定の間に出て、押すと onClick だけ。Promise の間は全部止まり押した方だけ処理中", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const calls: string[] = [];
  let resolveExtra: () => void = noop;
  let resolveConfirm: () => void = noop;
  const el = createElement(D, {
    ...confirmProps,
    onOpenChange: (o: boolean) => calls.push(`open:${o}`),
    onConfirm: () => new Promise<void>((r) => ((resolveConfirm = r), calls.push("confirm"))),
    extraAction: {
      label: "離れる",
      variant: "destructive",
      onClick: () => new Promise<void>((r) => ((resolveExtra = r), calls.push("extra"))),
    },
  });
  act(() => root.render(el));
  const buttons = () => [...document.querySelectorAll("[data-slot=dialog-footer] button")] as HTMLButtonElement[];
  assert.deepEqual(
    buttons().map((b) => b.textContent),
    ["やめる", "離れる", "削除"],
  );

  act(() => buttons()[1].click());
  assert.deepEqual([...calls], ["extra"]);
  assert.deepEqual(
    buttons().map((b) => b.textContent),
    ["やめる", "処理中...", "削除"],
  );
  assert.ok(buttons().every((b) => b.disabled));
  await act(async () => resolveExtra());
  assert.deepEqual(
    buttons().map((b) => b.textContent),
    ["やめる", "離れる", "削除"],
  );
  assert.ok(buttons().every((b) => !b.disabled));

  act(() => buttons()[2].click());
  assert.deepEqual([...calls], ["extra", "confirm"]);
  assert.deepEqual(
    buttons().map((b) => b.textContent),
    ["やめる", "離れる", "処理中..."],
  );
  assert.ok(buttons().every((b) => b.disabled));
  await act(async () => resolveConfirm());

  act(() => root.unmount());
  host.remove();
});

test("extraAction だけ(取り消しと確定なし)でも足元が出る・disabled が効く", () => {
  const s = snap(
    createElement(D, {
      open: true,
      onOpenChange: noop,
      title: "T",
      showCancelButton: false,
      showConfirmButton: false,
      extraAction: { label: "x", onClick: noop, disabled: true },
    }),
  );
  assert.match(s.contentInner ?? "", /data-slot="dialog-footer".*disabled="".*>x<\/button>/);
});
