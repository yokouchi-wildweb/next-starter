// MessagePreferences の検査(jsdom の上で描く。hook と toast は偽物)。
// - 種類と経路の切り替えを描き、押すと setCell / setAll を呼ぶ
// - 広い行で止まっているマスは押せず理由を出す / 宛先の無い経路は連携の案内(connectHref)
// 実行: pnpm test src/features/core/messaging/components/MessagePreferences/index.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
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

const cells: { category: string; channel: string; receive: boolean }[] = [];
const alls: boolean[] = [];
let preferences: unknown = null;
mock.module("@/features/core/messaging/hooks/useMessagePreferences", {
  namedExports: {
    MESSAGE_PREFERENCE_ALL: "*",
    preferenceCellKey: (a: string, b: string) => `${a}:${b}`,
    useMessagePreferences: () => ({
      preferences,
      isLoading: false,
      error: null,
      retry: () => {},
      pendingKey: null,
      setCell: async (category: string, channel: string, receive: boolean) => {
        cells.push({ category, channel, receive });
      },
      setAll: async (stopAll: boolean) => {
        alls.push(stopAll);
      },
    }),
  },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });
// 棚の Link は Next の router を要らない a に
mock.module("@/components/Navigation", {
  namedExports: { Link: ({ href, children, className }: { href: string; children: unknown; className?: string }) => createElement("a", { href, className }, children as never) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let MessagePreferences: typeof import("./index").MessagePreferences;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ MessagePreferences } = await import("./index"));
});
after(() => dom.window.close());
beforeEach(() => {
  cells.length = 0;
  alls.length = 0;
  preferences = {
    allOptedOut: false,
    channels: [
      { key: "email", label: "メール", hasAddress: true, connectHref: null },
      { key: "line", label: "LINE", hasAddress: false, connectHref: "/api/auth/line/login" },
    ],
    categories: [
      { key: "marketing", label: "お得な情報", description: "キャンペーンのお知らせ", kind: "marketing", cells: [
        { channel: "email", optedOut: false, via: null },
        { channel: "line", optedOut: true, via: "category" },
      ] },
    ],
  };
});

const mount = async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(MessagePreferences)));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const switchOf = (container: HTMLElement, label: string) =>
  container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | null;

test("種類・説明・経路を描き、受け取るマスを押すと止める(setCell receive false)", async () => {
  const view = await mount();
  const text = view.container.textContent ?? "";
  assert.match(text, /お得な情報/);
  assert.match(text, /キャンペーンのお知らせ/);
  const email = switchOf(view.container, "メールで受け取る");
  assert.ok(email, "メールの切り替え");
  await act(async () => email.click());
  assert.deepEqual(cells, [{ category: "marketing", channel: "email", receive: false }]);
  await view.unmount();
});

test("広い行で止まっているマスは押せず理由を出す。宛先の無い経路は連携の案内", async () => {
  const view = await mount();
  const line = switchOf(view.container, "LINEで受け取る");
  assert.ok(line?.disabled, "押せない");
  assert.match(view.container.textContent ?? "", /まとめて止める設定で止まっています/);
  assert.match(view.container.textContent ?? "", /宛先が登録されていません/);
  assert.equal(view.container.querySelector('a[href="/api/auth/line/login"]')?.textContent, "連携する");
  await view.unmount();
});

test("すべての連絡を止める → setAll(true)", async () => {
  const view = await mount();
  await act(async () => switchOf(view.container, "すべての連絡を止める")!.click());
  assert.deepEqual(alls, [true]);
  await view.unmount();
});

test("種類が無ければ文言", async () => {
  preferences = { allOptedOut: false, channels: [], categories: [] };
  const view = await mount();
  assert.match(view.container.textContent ?? "", /設定できる通知はありません/);
  await view.unmount();
});
