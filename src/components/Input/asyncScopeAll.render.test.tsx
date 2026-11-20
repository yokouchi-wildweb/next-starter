// AsyncComboboxInput の範囲のタブ(scopes)と「すべて」の選択肢(allOption)の検査(jsdom の上で開いて押す。searchFn は偽物で呼び出しを記録)。
// - scopes: 検索欄の下にタブ(count は「(n)」)、既定は先頭 / defaultScope。替えると searchFn が { scope } で呼び直される(先読み・検索とも)、制御の scope / onScopeChange
// - allOption: 候補の一番上に常に出て、選ぶと onChange(allOption.value)、その値の時はトリガーに label と行の印。上に留める行は出さない
// 既定(どちらも無し)の出力は asyncRenderOption.render.test.tsx が記録と比べる
// 実行: pnpm test src/components/Input/asyncScopeAll.render.test.tsx
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

type Item = { id: string; name: string };
const calls: { page: number; searchQuery?: string; scope?: string }[] = [];
const searchFn = async (params: { page?: number; searchQuery?: string }, context: { scope?: string }) => {
  calls.push({ page: params.page ?? 1, searchQuery: params.searchQuery, scope: context.scope });
  const items: Item[] = context.scope === "ended" ? [{ id: "9", name: "終わった" }] : [{ id: "1", name: "動いている" }];
  return { results: items, total: items.length };
};
const getOptionFromResult = (item: Item) => ({ value: item.id, label: item.name });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let AsyncComboboxInput: typeof import("./AsyncComboboxInput").AsyncComboboxInput;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  ({ AsyncComboboxInput } = await import("./AsyncComboboxInput"));
});
after(() => dom.window.close());

const tick = () => new Promise((r) => setTimeout(r, 20));
const scopes = [
  { value: "active", label: "稼働中", count: 3 },
  { value: "ended", label: "終了済み" },
];

async function mount(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const render = async (p: Record<string, unknown>) =>
    act(async () =>
      root.render(
        createElement(AsyncComboboxInput<Item>, { searchFn, getOptionFromResult, onChange: () => {}, ...p }),
      ),
    );
  await render(props);
  const open = async () => {
    const button = host.querySelector("button") as HTMLElement;
    await act(async () => {
      button.click();
    });
    await act(async () => {
      await tick();
    });
  };
  const content = () => document.querySelector("[data-slot=popover-content]")!;
  const unmount = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, render, open, content, unmount };
}

const tabs = (content: Element) => [...content.querySelectorAll("[role=tab]")] as HTMLElement[];
const pressTab = async (tab: HTMLElement) => {
  await act(async () => {
    tab.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
  await act(async () => {
    await tick();
  });
};

test("scopes: タブが出て、替えると選んだ範囲で取り直す(先読み・検索とも)", async () => {
  calls.length = 0;
  const m = await mount({ scopes });
  await m.open();
  const t = tabs(m.content());
  assert.deepEqual(
    t.map((x) => x.textContent),
    ["稼働中(3)", "終了済み"],
  );
  assert.equal(t[0].getAttribute("data-state"), "active");
  assert.deepEqual(calls.at(-1), { page: 1, searchQuery: undefined, scope: "active" });
  assert.ok(m.content().textContent?.includes("動いている"));

  await pressTab(t[1]);
  assert.equal(calls.at(-1)?.scope, "ended");
  assert.ok(m.content().textContent?.includes("終わった"));
  assert.ok(!m.content().textContent?.includes("動いている"));

  // 検索のモード: Enter で検索 → 範囲を替えると同じ語で取り直す
  const input = m.content().querySelector("input")!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "x");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await tick();
  });
  assert.equal(calls.at(-1)?.searchQuery, "x");
  assert.equal(calls.at(-1)?.scope, "ended");
  await pressTab(tabs(m.content())[0]);
  assert.deepEqual({ q: calls.at(-1)?.searchQuery, s: calls.at(-1)?.scope }, { q: "x", s: "active" });
  await m.unmount();
});

test("scopes: defaultScope と制御の scope / onScopeChange", async () => {
  calls.length = 0;
  const m = await mount({ scopes, defaultScope: "ended" });
  await m.open();
  assert.equal(calls.at(-1)?.scope, "ended");
  await m.unmount();

  const changes: string[] = [];
  calls.length = 0;
  const c = await mount({ scopes, scope: "active", onScopeChange: (s: string) => changes.push(s) });
  await c.open();
  await pressTab(tabs(c.content())[1]);
  // Radix の Tabs は押下と focus の両方で通知する(親が値を替えない間は 2 回)。通知の値だけを見る
  assert.ok(changes.length > 0 && changes.every((v) => v === "ended"), String(changes));
  // 親が値を替えるまで範囲は替わらない
  assert.equal(tabs(c.content())[0].getAttribute("data-state"), "active");
  await c.unmount();
});

test("allOption: 一番上に出て、選ぶと onChange(allOption.value)、その値の時はトリガーに label と印", async () => {
  const picked: unknown[] = [];
  const m = await mount({
    allOption: { value: "__all__", label: "すべてのマシン" },
    onChange: (v: unknown) => picked.push(v),
  });
  await m.open();
  const rows = [...m.content().querySelectorAll("[cmdk-item]")] as HTMLElement[];
  assert.equal(rows[0].textContent, "すべてのマシン");
  await act(async () => {
    rows[0].click();
  });
  assert.deepEqual(picked, ["__all__"]);
  await m.unmount();

  const s = await mount({ value: "__all__", allOption: { value: "__all__", label: "すべてのマシン" } });
  assert.match(s.host.textContent ?? "", /すべてのマシン/);
  await s.open();
  const first = s.content().querySelector("[cmdk-item]")!;
  assert.equal(first.textContent, "すべてのマシン");
  assert.ok(first.querySelector("svg.opacity-100"), "選んでいる印");
  // 上に留める行(値の解除の行)は出さない
  assert.equal(s.content().querySelector('[cmdk-item][data-value="__selected__"]'), null);
  await s.unmount();
});
