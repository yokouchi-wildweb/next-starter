// DispatchMeta の検査(jsdom の上で描く。props だけの部品、D210)。
// - 送信元は表示名がある時だけ、送信者(名前 / 名前の無い利用者 / システム)、予約日時はある時だけ、送信方法は表示名
// - 出どころ: 連絡定義 / テンプレート(版・文言を直した印・削除されたテンプレート)/ レイアウトから作成 / 前の送信は行なし。鍵は出さない
// 実行: pnpm test src/domains/core/messaging/components/common/DispatchMeta/index.test.tsx
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
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let parts: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  parts = await import("./index");
});
after(() => dom.window.close());

const mountEl = async (el: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(el));
  return { container, text: () => container.textContent ?? "", unmount: () => act(async () => root.unmount()) };
};

type Dispatch = Parameters<typeof import("./index").DispatchMeta>[0]["dispatch"];
const base: Dispatch = {
  sourceLabel: null,
  actor: { id: null, type: "system" },
  actorName: null,
  messageKey: null,
  definitionLabel: null,
  templateVersion: null,
  templateDeleted: false,
  templateEdited: false,
  content: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  scheduledAt: null,
  channels: ["email", "inApp"],
};
const CONTENT = { layout: "notice", layoutVersion: 1, values: {} };

test("出どころの文", () => {
  assert.equal(parts.dispatchOriginText({ ...base, messageKey: "bankTransferReview.statement" }), "連絡定義", "表示名が引けなければ連絡定義だけ");
  assert.equal(
    parts.dispatchOriginText({ ...base, messageKey: "bankTransferReview.statement", definitionLabel: "振込の明細" }),
    "連絡定義「振込の明細」",
  );
  assert.equal(parts.dispatchOriginText({ ...base, templateVersion: 3, content: CONTENT }), "テンプレート v3");
  assert.equal(parts.dispatchOriginText({ ...base, templateVersion: 2, templateEdited: true, content: CONTENT }), "テンプレート v2(文言を直して送信)");
  assert.equal(parts.dispatchOriginText({ ...base, templateVersion: 4, templateDeleted: true, templateEdited: true }), "削除されたテンプレート(v4・文言を直して送信)");
  assert.equal(parts.dispatchOriginText({ ...base, content: CONTENT }), "レイアウトから作成");
  assert.equal(parts.dispatchOriginText(base), null);
});

test("行: 送信元はある時だけ・送信者・予約日時はある時だけ・送信方法の表示名、鍵は出さない", async () => {
  const plain = await mountEl(createElement(parts.DispatchMeta, { dispatch: base }));
  const text = plain.text();
  assert.doesNotMatch(text, /送信元/);
  assert.match(text, /送信者システム/);
  assert.doesNotMatch(text, /出どころ/, "前の送信は出どころを出さない");
  assert.doesNotMatch(text, /予約日時/);
  assert.match(text, /送信方法メール \/ サービス内通知/);
  await plain.unmount();

  const full = await mountEl(
    createElement(parts.DispatchMeta, {
      dispatch: {
        ...base,
        sourceLabel: "管理者の一括送信",
        actor: { id: "a1", type: "admin" },
        messageKey: "bankTransferReview.statement",
        definitionLabel: "振込の明細",
        scheduledAt: "2026-11-02T00:00:00.000Z",
      },
    }),
  );
  const t = full.text();
  assert.match(t, /送信元管理者の一括送信/);
  assert.match(t, /送信者\(名前未設定のユーザー\)/);
  assert.match(t, /出どころ連絡定義「振込の明細」/);
  assert.match(t, /予約日時/);
  assert.doesNotMatch(t, /bankTransferReview|\ba1\b/, "鍵・id は出さない");
  await full.unmount();
});
