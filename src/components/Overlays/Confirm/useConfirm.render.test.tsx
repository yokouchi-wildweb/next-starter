// Promise を返す確認 useConfirm の検査(jsdom の上で開いて押す)。
// - confirm(options) で Dialog が開き、確定で true・取り消し / ESC で false に解ける。既定の文言(OK / キャンセル)
// - 開いている間の次の confirm は前を false で解いて次を出す / 部品が外れたら待っている物は false
// 実行: pnpm test src/components/Overlays/Confirm
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
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useConfirm: typeof import("./index").useConfirm;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  useConfirm = (await import("./index")).useConfirm;
});
after(() => dom.window.close());

type Confirm = ReturnType<typeof useConfirm>["confirm"];

/** useConfirm を置いた画面を描き、confirm を外へ渡す */
function mount() {
  let confirm: Confirm = async () => false;
  const capture = (fn: Confirm) => {
    confirm = fn;
  };
  const Screen = () => {
    const r = useConfirm();
    capture(r.confirm);
    return r.confirmDialog;
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(Screen)));
  return {
    confirm: (...args: Parameters<Confirm>) => confirm(...args),
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

const buttons = () => [...document.querySelectorAll("[data-slot=dialog-footer] button")] as HTMLButtonElement[];
const dialog = () => document.querySelector("[role=dialog]");

test("確定で true、取り消しと ESC で false。既定の文言と渡した文言", async () => {
  const s = mount();
  assert.equal(dialog(), null);

  let p!: Promise<boolean>;
  act(() => {
    p = s.confirm({ title: "オフにしますか", confirmLabel: "オフ", confirmVariant: "destructive" });
  });
  assert.ok(dialog()?.textContent?.includes("オフにしますか"));
  assert.deepEqual(
    buttons().map((b) => b.textContent),
    ["キャンセル", "オフ"],
  );
  act(() => buttons()[1].click());
  assert.equal(await p, true);
  assert.equal(dialog(), null);

  act(() => {
    p = s.confirm();
  });
  assert.deepEqual(
    buttons().map((b) => b.textContent),
    ["キャンセル", "OK"],
  );
  act(() => buttons()[0].click());
  assert.equal(await p, false);

  act(() => {
    p = s.confirm();
  });
  act(() => {
    dialog()!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  assert.equal(await p, false);
  assert.equal(dialog(), null);
  s.unmount();
});

test("開いている間の次の confirm は前を false で解き、外れたら待っている物は false", async () => {
  const s = mount();
  let first!: Promise<boolean>;
  let second!: Promise<boolean>;
  act(() => {
    first = s.confirm({ title: "1" });
  });
  act(() => {
    second = s.confirm({ title: "2" });
  });
  assert.equal(await first, false);
  assert.ok(dialog()?.textContent?.includes("2"));
  s.unmount();
  assert.equal(await second, false);
});
