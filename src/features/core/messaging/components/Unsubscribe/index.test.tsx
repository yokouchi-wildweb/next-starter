// Unsubscribe(確認のページの入れ物)と流れの hook useUnsubscribe の検査(jsdom の上で描く。client service と棚の Link は偽物 = 入れ物 + hook を本物で通す)。
// - 正しくないトークン → 「リンクが正しくありません」
// - 確認(種類・経路)→ 押すと POST(トークン)→ 「配信を停止しました」+ 通知の設定への案内
// - 失敗 → 確認のまま失敗の文、もう一度押せる
// 実行: pnpm test src/features/core/messaging/components/Unsubscribe/index.test.tsx
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
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const posted: string[] = [];
let fail = false;
mock.module("@/features/core/messaging/services/client/unsubscribeClient", {
  namedExports: {
    postUnsubscribe: async (token: string) => {
      posted.push(token);
      if (fail) throw new Error("トークンが正しくありません");
    },
  },
});
mock.module("@/components/Navigation", {
  namedExports: { Link: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let Unsubscribe: typeof import("./index").Unsubscribe;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  ({ Unsubscribe } = await import("./index"));
});
after(() => dom.window.close());
beforeEach(() => {
  posted.length = 0;
  fail = false;
});

const mount = async (props: Parameters<typeof Unsubscribe>[0]) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map() } }, createElement(Unsubscribe, props))));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const text = (c: HTMLElement) => c.textContent ?? "";
const button = (c: HTMLElement) => [...c.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("配信を停止する"));
const valid = { valid: true as const, token: "tok", categoryLabel: "キャンペーン情報", channelLabel: "メール" };

test("正しくないトークン → リンクが正しくありません(ボタン無し)", async () => {
  const view = await mount({ valid: false });
  assert.match(text(view.container), /リンクが正しくありません/);
  assert.equal(button(view.container), undefined);
  await view.unmount();
});

test("確認 → 押すと POST → 停止しました + 通知の設定への案内", async () => {
  const view = await mount(valid);
  assert.match(text(view.container), /「キャンペーン情報」のメールの配信を停止します/);
  await act(async () => button(view.container)!.click());
  assert.deepEqual(posted, ["tok"]);
  assert.match(text(view.container), /配信を停止しました/);
  assert.equal(view.container.querySelector('a[href="/mypage/account/notifications"]')?.textContent, "通知の設定を見る");
  await view.unmount();
});

test("失敗 → 確認のまま失敗の文、もう一度押せる", async () => {
  fail = true;
  const view = await mount(valid);
  await act(async () => button(view.container)!.click());
  assert.match(text(view.container), /配信を停止できませんでした|トークンが正しくありません/);
  assert.ok(button(view.container) && !button(view.container)!.disabled);
  fail = false;
  await act(async () => button(view.container)!.click());
  assert.equal(posted.length, 2);
  assert.match(text(view.container), /配信を停止しました/);
  await view.unmount();
});
