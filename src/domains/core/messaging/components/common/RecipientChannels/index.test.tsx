// RecipientChannels の検査(jsdom の上で描く。props だけの部品、D214 (2))。
// - 送信チャンネルごとに受け取れる / 受け取れない + 理由の表示名(口の返す順)。選べなくする等はしない(ボタン・入力を描かない)
// - まだ無い時: 読み込み中・誤り・何も出さない
// 実行: pnpm test src/domains/core/messaging/components/common/RecipientChannels/index.test.tsx
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
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let parts: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  parts = await import("./index");
});
after(() => dom.window.close());

type Props = Parameters<typeof import("./index").RecipientChannels>[0];
const render = async (props: Props) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(parts.RecipientChannels, props)));
  return { container, unmount: () => act(async () => root.unmount()) };
};

test("recipientChannelReasonText: 受け取れる = null、受け取れない = 理由の表示名", () => {
  assert.equal(parts.recipientChannelReasonText({ available: true }), null);
  assert.equal(parts.recipientChannelReasonText({ available: false, reason: "channel_off" }), "送信方法が無効");
  assert.equal(parts.recipientChannelReasonText({ available: false, reason: "suppression" }), "配信停止リスト");
});

test("送信チャンネルごとに受け取れるか(口の順)、選べなくはしない", async () => {
  const view = await render({
    channels: { inApp: { available: true }, email: { available: false, reason: "no_address" } },
  });
  const rows = [...view.container.querySelectorAll("[data-slot=recipient-channel]")].map((row) => row.textContent ?? "");
  assert.equal(rows.length, 2);
  assert.match(rows[0]!, /^サービス内通知受け取れる$/);
  assert.match(rows[1]!, /メール受け取れない理由: 連絡先未登録/);
  assert.equal(view.container.querySelectorAll("button, input").length, 0);
  await view.unmount();
});

test("まだ無い時: 読み込み中・誤り・何も出さない", async () => {
  const loading = await render({ channels: null, isLoading: true });
  assert.equal(loading.container.querySelector("[data-slot=recipient-channels]"), null);
  assert.ok((loading.container.innerHTML ?? "").length > 0, "読み込み中を出す");
  await loading.unmount();
  const failed = await render({ channels: null, error: new Error("x") });
  assert.match(failed.container.textContent ?? "", /\S/);
  await failed.unmount();
  const none = await render({ channels: null });
  assert.equal(none.container.innerHTML, "");
  await none.unmount();
});
