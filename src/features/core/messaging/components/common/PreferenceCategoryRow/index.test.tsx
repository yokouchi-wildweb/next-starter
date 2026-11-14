// 好みの部品の検査(props だけの部品: PreferenceCategoryRow・PreferenceChannelSection・PreferenceKindFrame・PreferenceGroupHeading・
// PreferenceCategoryWideToggle。jsdom の上で描く。棚の Link は偽物)。
// 実行: pnpm test src/features/core/messaging/components/common/PreferenceCategoryRow/index.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;
mock.module("@/components/Navigation", {
  namedExports: { Link: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let parts: {
  row: typeof import("./index");
  section: typeof import("../PreferenceChannelSection");
  frame: typeof import("../PreferenceKindFrame");
  group: typeof import("../PreferenceGroupHeading");
  wide: typeof import("../PreferenceCategoryWideToggle");
};
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  parts = {
    row: await import("./index"),
    section: await import("../PreferenceChannelSection"),
    frame: await import("../PreferenceKindFrame"),
    group: await import("../PreferenceGroupHeading"),
    wide: await import("../PreferenceCategoryWideToggle"),
  };
});
after(() => dom.window.close());

const render = async (element: ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const input = (c: HTMLElement, label: string) => c.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
const cat = (optedOut: boolean, via: string | null) => ({ key: "likes", label: "いいね", description: "反応の知らせ", optedOut, via }) as never;

test("PreferenceCategoryRow: 入 = 受け取る、押すと onChange(!今)。広い行は理由、全部の下だけ押せない", async () => {
  const changes: boolean[] = [];
  const on = await render(createElement(parts.row.PreferenceCategoryRow, { category: cat(false, null), channelLabel: "メール", onChange: (v: boolean) => changes.push(v) }));
  assert.match(on.container.textContent ?? "", /反応の知らせ/);
  await act(async () => input(on.container, "いいねをメールで受け取る").click());
  assert.deepEqual(changes, [false]);
  await on.unmount();

  for (const [via, reason, locked] of [
    ["kind", "まとめて止める設定で止まっています", false],
    ["category", "このカテゴリーをすべての経路で止めています", false],
    ["channel", "この経路をまとめて止めています", false],
    ["all", "すべての連絡を止めています", true],
  ] as const) {
    const view = await render(createElement(parts.row.PreferenceCategoryRow, { category: cat(true, via), channelLabel: "メール", onChange: () => {} }));
    assert.match(view.container.textContent ?? "", new RegExp(reason));
    assert.equal(input(view.container, "いいねをメールで受け取る").disabled, locked, via);
    await view.unmount();
  }
});

test("PreferenceChannelSection: 題・経路まるごと(入 = 受け取る)・宛先が無ければ連携の案内・children", async () => {
  const stops: boolean[] = [];
  const view = await render(
    createElement(
      parts.section.PreferenceChannelSection,
      { channel: { key: "line", label: "LINE", hasAddress: false, connectHref: "/link", optedOut: false }, onChannelWideChange: (v: boolean) => stops.push(v) },
      createElement("p", null, "CHILD"),
    ),
  );
  assert.match(view.container.textContent ?? "", /LINE/);
  assert.match(view.container.textContent ?? "", /CHILD/);
  assert.equal(view.container.querySelector('a[href="/link"]')?.textContent, "連携する");
  await act(async () => input(view.container, "LINEで受け取る").click());
  assert.deepEqual(stops, [true]);
  await view.unmount();
});

test("PreferenceChannelSection: 全部の停止の間(stoppedByAll)は経路の行によらず切・押せない・理由を出す", async () => {
  const channel = { key: "email", label: "メール", hasAddress: true, connectHref: null, optedOut: false };
  const free = await render(createElement(parts.section.PreferenceChannelSection, { channel, onChannelWideChange: () => {} }));
  assert.equal(input(free.container, "メールで受け取る").checked, true);
  assert.equal(input(free.container, "メールで受け取る").disabled, false);
  assert.doesNotMatch(free.container.textContent ?? "", /すべての連絡を止めています/);
  await free.unmount();
  const all = await render(createElement(parts.section.PreferenceChannelSection, { channel, stoppedByAll: true, onChannelWideChange: () => {} }));
  assert.equal(input(all.container, "メールで受け取る").checked, false);
  assert.equal(input(all.container, "メールで受け取る").disabled, true);
  assert.match(all.container.textContent ?? "", /すべての連絡を止めています/);
  await all.unmount();
});

test("PreferenceKindFrame は見出しだけ(スイッチ無し)、PreferenceGroupHeading は null で何も描かない", async () => {
  const frame = await render(createElement(parts.frame.PreferenceKindFrame, { label: "キャンペーン情報" }, createElement("p", null, "ROWS")));
  assert.match(frame.container.textContent ?? "", /キャンペーン情報ROWS/);
  assert.equal(frame.container.querySelector("input"), null);
  await frame.unmount();
  const none = await render(createElement(parts.group.PreferenceGroupHeading, { label: null }));
  assert.equal(none.container.innerHTML, "");
  await none.unmount();
  const named = await render(createElement(parts.group.PreferenceGroupHeading, { label: "つながり" }));
  assert.match(named.container.textContent ?? "", /つながり/);
  await named.unmount();
});

test("PreferenceCategoryWideToggle: 入 = 止めている、押すと onChange(!今)", async () => {
  const stops: boolean[] = [];
  const view = await render(createElement(parts.wide.PreferenceCategoryWideToggle, { categoryLabel: "いいね", stopped: false, onChange: (v: boolean) => stops.push(v) }));
  assert.match(view.container.textContent ?? "", /このカテゴリーをすべての経路で止める/);
  await act(async () => input(view.container, "いいねをすべての経路で止める").click());
  assert.deepEqual(stops, [true]);
  await view.unmount();
});

test("PreferenceCategoryWideToggle: 全部の停止の間(stoppedByAll)は種類まるごとの行によらず入(止まっている)・押せない", async () => {
  const view = await render(createElement(parts.wide.PreferenceCategoryWideToggle, { categoryLabel: "いいね", stopped: false, stoppedByAll: true, onChange: () => {} }));
  assert.equal(input(view.container, "いいねをすべての経路で止める").checked, true);
  assert.equal(input(view.container, "いいねをすべての経路で止める").disabled, true);
  await view.unmount();
});
