// 非同期の選択の入力(AsyncComboboxInput / AsyncMultiSelectInput)の行の描き分け renderOption の検査(jsdom の上で開く。searchFn は偽物)。
// - renderOption を渡さない時: トリガーと開いた中身が変更の前に記録した出力(__fixtures__/asyncInputs.before.json)と同じ
// - 渡すと候補の行・上に留める選んだ行がその node で描かれ、第 2 引数に取得した元の行(未取得は undefined)。トリガーは label のまま
// 実行: pnpm test src/components/Input/asyncRenderOption.render.test.tsx
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
g.requestAnimationFrame = dom.window.requestAnimationFrame;
g.cancelAnimationFrame = dom.window.cancelAnimationFrame;
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
g.DOMRect = dom.window.DOMRect;
g.IS_REACT_ACT_ENVIRONMENT = true;

const BEFORE = JSON.parse(
  readFileSync(new URL("./__fixtures__/asyncInputs.before.json", import.meta.url), "utf8"),
) as Record<string, { trigger: string; content: string }>;

type Item = { id: string; name: string; status: string };
const ITEMS: Item[] = [
  { id: "1", name: "りんご", status: "on" },
  { id: "2", name: "みかん", status: "off" },
];
const searchFn = async () => ({ results: ITEMS, total: ITEMS.length });
const getOptionFromResult = (item: Item) => ({ value: item.id, label: item.name });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let AsyncComboboxInput: typeof import("./AsyncComboboxInput").AsyncComboboxInput;
let AsyncMultiSelectInput: typeof import("./AsyncMultiSelectInput").AsyncMultiSelectInput;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  ({ AsyncComboboxInput } = await import("./AsyncComboboxInput"));
  ({ AsyncMultiSelectInput } = await import("./AsyncMultiSelectInput"));
});
after(() => dom.window.close());

const tick = () => new Promise((r) => setTimeout(r, 20));
const clean = (html: string | undefined) =>
  (html ?? "").replace(/radix-[^"]+/g, "ID").replace(/«[^»]*»|:r[0-9a-z]+:/g, "ID");

/** 描いて開き、トリガーと開いた中身を読む */
async function snapOpen(el: ReturnType<typeof createElement>, read?: () => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(el));
  const trigger = host.innerHTML;
  const button = host.querySelector("button[aria-haspopup], [role=combobox], button") as HTMLElement;
  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    button.click();
  });
  await act(async () => {
    await tick();
  });
  const content = document.querySelector("[data-slot=popover-content]");
  const out = { trigger: clean(trigger), content: clean(content?.innerHTML) };
  read?.();
  await act(async () => root.unmount());
  host.remove();
  return out;
}

const noop = () => {};

test("renderOption なし: 単一(値なし / 値あり)と複数の出力が前と同じ", async () => {
  assert.deepEqual(
    await snapOpen(createElement(AsyncComboboxInput<Item>, { onChange: noop, searchFn, getOptionFromResult })),
    BEFORE.comboEmpty,
  );
  assert.deepEqual(
    await snapOpen(
      createElement(AsyncComboboxInput<Item>, {
        value: "2",
        onChange: noop,
        searchFn,
        getOptionFromResult,
        initialOption: { value: "2", label: "みかん" },
      }),
    ),
    BEFORE.comboValue,
  );
  assert.deepEqual(
    await snapOpen(
      createElement(AsyncMultiSelectInput<Item>, {
        value: ["1"],
        onChange: noop,
        searchFn,
        getOptionFromResult,
        initialOptions: [{ value: "1", label: "りんご" }],
      }),
    ),
    BEFORE.multi,
  );
});

const renderOption = (option: { value: unknown; label: unknown }, item: Item | undefined) =>
  createElement("x-row", { "data-status": item?.status ?? "none" }, String(option.label));

test("単一: 候補の行と上に留める選んだ行が renderOption で描かれ、item が来る。トリガーは label", async () => {
  const s = await snapOpen(
    createElement(AsyncComboboxInput<Item>, {
      value: "2",
      onChange: noop,
      searchFn,
      getOptionFromResult,
      initialOption: { value: "2", label: "みかん" },
      renderOption,
    }),
  );
  assert.match(s.content, /<x-row data-status="on">りんご<\/x-row>/);
  // 上に留める行(値 2): 先読みで取得済みなので item が来る
  assert.match(s.content, /<x-row data-status="off">みかん<\/x-row>/);
  assert.doesNotMatch(s.trigger, /x-row/);
  assert.match(s.trigger, /みかん/);
});

test("複数: 候補の行が renderOption で描かれ、item が来る。トリガーのチップは label", async () => {
  const s = await snapOpen(
    createElement(AsyncMultiSelectInput<Item>, {
      value: ["1"],
      onChange: noop,
      searchFn,
      getOptionFromResult,
      initialOptions: [{ value: "1", label: "りんご" }],
      renderOption,
    }),
  );
  assert.deepEqual(s.content.match(/<x-row[^>]*>[^<]*<\/x-row>/g), [
    '<x-row data-status="on">りんご</x-row>',
    '<x-row data-status="off">みかん</x-row>',
  ]);
  assert.doesNotMatch(s.trigger, /x-row/);
});
