// 文言の上書きを直すモーダルの入れ物と、一覧からの開き方の検査(jsdom の上で描く。hook・Modal・部品は偽物)。
// - 鍵が無い間は描かない / confirmOnClose に hook の closeConfirm / 欄ごとに OverrideFieldEditor を並べる / 読み込み中
// - 開き直すと中身を作り直す(下書きを捨てる = hook を呼び直す)
// - 一覧: 行でモーダルの開き先を変える(1 件の住所へのリンクは無い)
// 実行: pnpm test src/features/core/messaging/components/AdminMessageOverrideModal/AdminMessageOverrideModal.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useState } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const events: string[] = [];
let editor: Record<string, unknown> = {};
let editorMounts = 0;
const FIELD = { path: "email.subject" };
const baseEditor = () => ({
  detail: { key: "user.welcome", label: "会員登録の完了", kind: "transactional", category: "x", categoryLabel: "お手続き", fields: [FIELD, { path: "email.body" }] },
  error: null,
  isLoading: false,
  allowedKeys: [],
  closeConfirm: { enabled: true, message: "下書き" },
  valueOf: () => "",
  setDraft: () => {},
  isDirty: () => false,
  unknownKeys: () => [],
  save: async () => {},
  reset: async () => {},
  discard: () => {},
});
mock.module("@/features/core/messaging/hooks/useMessageOverrideEditor", {
  namedExports: {
    useMessageOverrideEditor: () => {
      useState(() => (editorMounts += 1));
      return editor;
    },
  },
});
let modalProps: Record<string, unknown> | null = null;
mock.module("@/components/Overlays/Modal", {
  defaultExport: (props: Record<string, unknown>) => {
    modalProps = props;
    return props.open ? createElement("section", { "data-testid": "modal" }, props.children as never) : null;
  },
});
mock.module("@/components/Form/Button", {
  namedExports: {
    Button: (props: { children?: unknown; onClick?: () => void }) => createElement("button", { type: "button", onClick: props.onClick }, props.children as never),
  },
});
const stub = (name: string) => {
  const Stub = () => createElement("div", { "data-part": name });
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
mock.module("@/features/core/messaging/components/common/AllowedKeysHint", { namedExports: { AllowedKeysHint: stub("keys") } });
mock.module("@/features/core/messaging/components/common/OverrideFieldEditor", { namedExports: { OverrideFieldEditor: stub("field") } });
let listState: Record<string, unknown> = {};
mock.module("@/features/core/messaging/hooks/useAdminMessageOverrideList", {
  namedExports: { useAdminMessageOverrideList: () => listState },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let AdminMessageOverrideModal: typeof import("./index").AdminMessageOverrideModal;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ AdminMessageOverrideModal } = await import("./index"));
});
after(() => dom.window.close());
beforeEach(() => {
  events.length = 0;
  editor = baseEditor();
  editorMounts = 0;
  modalProps = null;
});

const mountRoot = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return {
    container,
    draw: (element: ReturnType<typeof createElement>) => act(async () => root.render(element)),
    unmount: () => act(async () => root.unmount()),
  };
};
const parts = (container: HTMLElement) => [...container.querySelectorAll("[data-part]")].map((el) => el.getAttribute("data-part"));
const props = (open: boolean, messageKey: string | null) => ({ open, onOpenChange: () => {}, messageKey });

test("鍵が無い間は描かない / 欄を並べ、confirmOnClose に closeConfirm", async () => {
  const view = mountRoot();
  await view.draw(createElement(AdminMessageOverrideModal, props(true, null)));
  assert.equal(modalProps, null);
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.deepEqual(parts(view.container), ["keys", "field", "field"]);
  assert.deepEqual(modalProps!.confirmOnClose, { enabled: true, message: "下書き" });
  // 連絡の名前・種別とカテゴリーの表示名で、鍵は出さない(D46)
  assert.equal(modalProps!.title, "文言を直す: 会員登録の完了");
  assert.match(view.container.textContent ?? "", /お手続きのお知らせ \/ お手続き/);
  assert.doesNotMatch(view.container.textContent ?? "", /user\.welcome|transactional/);
  await view.unmount();
});

test("読み込み中 / 開き直すと中身を作り直す", async () => {
  editor = { ...baseEditor(), detail: null, isLoading: true };
  const view = mountRoot();
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.deepEqual(parts(view.container), []);
  assert.equal(editorMounts, 1);
  await view.draw(createElement(AdminMessageOverrideModal, props(false, "user.welcome")));
  assert.equal(editorMounts, 1, "閉じる間は中身を残す");
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.equal(editorMounts, 2);
  await view.unmount();
});

test("一覧: 行でモーダルの開き先を変える", async () => {
  const { AdminMessageOverrideList } = await import("../AdminMessageOverrideList");
  listState = {
    items: [{ key: "user.welcome", label: "会員登録の完了", kind: "transactional", category: "x", categoryLabel: "お手続き", editableCount: 1, editedCount: 0, codeChangedCount: 0, orphanCount: 0 }],
    error: null,
    isLoading: false,
    modal: { open: false, setOpen: () => {}, messageKey: null, openMessage: (key: string) => events.push(`open:${key}`) },
  };
  const view = mountRoot();
  await view.draw(createElement(AdminMessageOverrideList));
  await act(async () => (view.container.querySelector("button") as HTMLButtonElement).click());
  assert.deepEqual(events, ["open:user.welcome"]);
  assert.match(view.container.textContent ?? "", /会員登録の完了/);
  assert.doesNotMatch(view.container.textContent ?? "", /user\.welcome|transactional/);
  assert.equal(view.container.querySelector("a"), null);
  await view.unmount();
});
