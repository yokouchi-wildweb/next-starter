// FilePickButton の検査
// - 出力: label が Button と同じ class(baseButtonClassName + buttonVariants)を持ち、中に隠した file の input
// - Enter / Space で input を開く(click)、disabled では開かない
// - 選んだファイルで onFiles を呼び、input を空に戻す
// 実行: pnpm test src/components/Input/FilePickButton
// (tsx + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Element", "Node", "navigator", "getComputedStyle", "DocumentFragment", "MutationObserver", "Event", "KeyboardEvent", "File"]) {
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Mod: typeof import(".");
let Btn: typeof import("@/components/Button/Button");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  Mod = await import(".");
  Btn = await import("@/components/Button/Button");
});
after(() => dom.window.close());

async function mount(props: Omit<import(".").FilePickButtonProps, "children">) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(h(Mod.FilePickButton, { ...props, children: "選ぶ" })));
  const label = container.querySelector("label") as HTMLLabelElement;
  const input = container.querySelector("input") as HTMLInputElement;
  return { root, label, input };
}

test("見た目は同じ variant / size の Button と同じ class、中に隠した file の input", () => {
  const html = renderToStaticMarkup(h(Mod.FilePickButton, { variant: "outline", size: "xs", accept: "video/*", onFiles: () => {}, children: "映像を選択" }));
  const btn = renderToStaticMarkup(h(Btn.Button, { variant: "outline", size: "xs" }, "x"));
  const btnClass = /class="([^"]+)"/.exec(btn)?.[1];
  const labelClass = /<label[^>]*class="([^"]+)"/.exec(html)?.[1];
  assert.equal(labelClass, btnClass);
  assert.match(html, /^<label data-slot="file-pick-button" tabindex="0"/);
  const input = /映像を選択(<input [^>]*\/>)<\/label>$/.exec(html)?.[1] ?? "";
  assert.match(input, /type="file"/);
  assert.match(input, /accept="video\/\*"/);
  assert.match(input, / hidden=""/);
});

test("Enter / Space で選択を開き、disabled では開かない", async () => {
  const { root, label, input } = await mount({ onFiles: () => {} });
  let opened = 0;
  input.click = () => {
    opened += 1;
  };
  await act(async () => {
    label.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    label.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    label.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
  });
  assert.equal(opened, 2);
  await act(async () => root.unmount());

  const d = await mount({ onFiles: () => {}, disabled: true });
  let openedDisabled = 0;
  d.input.click = () => {
    openedDisabled += 1;
  };
  await act(async () => {
    d.label.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  assert.equal(openedDisabled, 0);
  assert.equal(d.label.getAttribute("tabindex"), "-1");
  assert.equal(d.label.getAttribute("aria-disabled"), "true");
  assert.equal(d.input.disabled, true);
  await act(async () => d.root.unmount());
});

test("選んだファイルで onFiles を呼び、input を空に戻す", async () => {
  const got: File[][] = [];
  const { root, input } = await mount({ onFiles: (files) => got.push(files) });
  const file = new File(["x"], "a.txt", { type: "text/plain" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(got.length, 1);
  assert.equal(got[0][0].name, "a.txt");
  assert.equal(input.value, "");
  await act(async () => root.unmount());
});
