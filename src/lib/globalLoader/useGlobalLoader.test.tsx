// 全体のローダーの重なり(D111・D114): 処理ごとに自分の分を持ち、全部の終わりまで出し続ける
// - 先に終わった処理が他の処理の表示を消さない(research cc-r11-frameless-default Q3 の順: A を出す → B を出す → A の終わり)
// - 文は残っている中で最後に出した物 / 終わりの関数は 1 回だけ効く / unmount はその部品の分だけ外す
// 実行: pnpm test src/lib/globalLoader/useGlobalLoader.test.tsx(tsx + jsdom。CJS なので before() で import)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "SVGElement", "Element", "Node", "navigator", "getComputedStyle", "DocumentFragment", "MutationObserver", "Event", "requestAnimationFrame", "cancelAnimationFrame"]) {
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Lib: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  Lib = await import("./index");
});
after(() => dom.window.close());

type Show = ReturnType<typeof import("./index").useGlobalLoader>["showLoader"];

/** 呼び手の部品を 2 つ(a・b)と GlobalScreenLoader を描き、それぞれの showLoader を返す */
async function mount() {
  document.body.innerHTML = "";
  const shows: Partial<Record<"a" | "b", Show>> = {};
  function Caller({ name }: { name: "a" | "b" }) {
    shows[name] = Lib.useGlobalLoader().showLoader;
    return null;
  }
  function App({ withB }: { withB: boolean }) {
    return h("div", null, h(Caller, { name: "a" }), withB ? h(Caller, { name: "b" }) : null, h(Lib.GlobalScreenLoader));
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(h(App, { withB: true })));
  const shown = () => document.body.querySelector(':scope > [role="status"]')?.textContent ?? null;
  return { a: shows.a!, b: shows.b!, root, App, shown };
}

test("重なり: A を出す → B を出す → A の終わり → B が残り文は B → B の終わりで消える", async () => {
  const { a, b, root, shown } = await mount();
  let endA!: () => void;
  let endB!: () => void;
  await act(async () => {
    endA = a("A");
  });
  assert.equal(shown(), "A");
  await act(async () => {
    endB = b("B");
  });
  assert.equal(shown(), "B", "文は最後に出した物");
  await act(async () => endA());
  assert.equal(shown(), "B", "先に終わった A が B の表示を消さない");
  await act(async () => endB());
  assert.equal(shown(), null);
  await act(async () => root.unmount());
});

test("後に出した方が先に終わると、残っている中で最後の文に戻る", async () => {
  const { a, b, root, shown } = await mount();
  let endA!: () => void;
  let endB!: () => void;
  await act(async () => {
    endA = a("A");
    endB = b("B");
  });
  await act(async () => endB());
  assert.equal(shown(), "A");
  await act(async () => endA());
  assert.equal(shown(), null);
  await act(async () => root.unmount());
});

test("終わりの関数は 1 回だけ効く(2 回目で他の分を外さない)", async () => {
  const { a, root, shown } = await mount();
  let first!: () => void;
  let second!: () => void;
  await act(async () => {
    first = a("first");
    second = a("second");
  });
  await act(async () => {
    first();
    first();
  });
  assert.equal(shown(), "second");
  await act(async () => second());
  assert.equal(shown(), null);
  await act(async () => root.unmount());
});

test("unmount はその部品が出してまだ終わっていない分だけ外す", async () => {
  const { a, b, root, App, shown } = await mount();
  await act(async () => {
    a("A");
    b("B");
  });
  await act(async () => root.render(h(App, { withB: false })));
  assert.equal(shown(), "A", "b の部品が外れても a の分は残る");
  await act(async () => root.unmount());
  assert.equal(document.body.querySelector(':scope > [role="status"]'), null);
});
