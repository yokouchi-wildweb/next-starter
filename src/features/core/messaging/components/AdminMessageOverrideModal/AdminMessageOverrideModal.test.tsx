// 文言の編集を直すモーダルの入れ物と、一覧からの開き方の検査(jsdom の上で描く。hook・Modal・部品は偽物)。
// - 鍵が無い間は描かない / confirmOnClose に hook の closeConfirm / 今の経路の欄ごとに OverrideFieldEditor を並べる / 読み込み中・取れない時
// - 名前・種別とカテゴリーの表示名(鍵は出さない、D46)/ 左のプレビュー(LayoutPreview)/ 下の帯の左に埋め込み情報の吹き出し
// - 保存は 1 回(D132): 下の帯の「保存」は下書きが無ければ押せず、確かめると saveAll
// - 「すべてデフォルトに戻す」(D136): 変わる物が無ければ押せず、確かめると resetAll
// - 開き直すと中身を作り直す(入力を破棄 = hook を呼び直す)
// - 一覧: 行でモーダルの開き先を変える(1 件の住所へのリンクは無い)
// 実行: pnpm test src/features/core/messaging/components/AdminMessageOverrideModal/AdminMessageOverrideModal.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useState, type ReactNode } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const events: string[] = [];
let editor: Record<string, unknown> = {};
let editorMounts = 0;
const CHANNEL = { key: "email", label: "メール" };
// 欄 = ひな形の欄(D132)。経路のタブで絞った今の経路の欄だけを並べる(activeFields)
const field = (path: string) => ({
  path,
  spec: { type: "line", label: path },
  channels: ["email"],
  editable: true,
  codeValue: "",
  value: null,
  effective: "",
  edited: false,
  codeChanged: false,
  unusable: false,
  problem: null,
  updatedAt: null,
});
const FIELDS = [field("subject"), field("body")];
const baseEditor = () => ({
  detail: { key: "user.welcome", label: "会員登録の完了", kind: "transactional", category: "x", categoryLabel: "お手続き", channels: [CHANNEL], fields: FIELDS },
  error: null,
  isLoading: false,
  channels: [CHANNEL],
  activeChannel: "email",
  setActiveChannel: (key: string) => events.push(`channel:${key}`),
  activeFields: FIELDS,
  setFocusedPath: () => {},
  previewLayout: "simple",
  previewContent: null,
  previewLoading: false,
  embeddedTags: { common: [], own: [], copy: () => {}, toAliases: <T,>(value: T) => value },
  unusableCount: 0,
  valueOf: () => "",
  setDraft: () => {},
  isDirty: () => false,
  isResetPending: () => false,
  hasDrafts: false,
  pendingCount: 0,
  fieldErrors: {},
  isSaving: false,
  closeConfirm: { enabled: true, message: "下書き" },
  unknownKeys: () => [],
  codeValueOf: () => "",
  saveAll: async () => {
    events.push("saveAll");
  },
  reset: () => {},
  resetAll: () => {
    events.push("resetAll");
  },
  canResetAll: false,
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
    return props.open ? createElement("section", { "data-testid": "modal" }, props.children as ReactNode, props.footer as ReactNode) : null;
  },
});
type ButtonProps = { children?: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; "data-slot"?: string };
// loading は本物の Button と同じく押せなくする(disabled)
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: ButtonProps) =>
      createElement("button", { type: "button", onClick: props.onClick, disabled: props.disabled || props.loading, "data-slot": props["data-slot"] }, props.children),
  },
});
// 確かめの吹き出し: 引き金と「ok:<確かめの字>」のボタン(押すと onConfirm)
mock.module("@/components/Overlays/Popover", {
  namedExports: {
    ConfirmPopover: (props: { trigger: ReactNode; confirmLabel: string; onConfirm: () => unknown }) =>
      createElement("span", null, props.trigger, createElement("button", { type: "button", "data-confirm": props.confirmLabel, onClick: () => void props.onConfirm() }, `ok:${props.confirmLabel}`)),
  },
});
const stub = (name: string, text?: (props: Record<string, unknown>) => string) => {
  const Stub = (props: Record<string, unknown>) => createElement("div", { "data-part": name }, text ? text(props) : null);
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
mock.module("@/features/core/messaging/components/common/OverrideFieldEditor", { namedExports: { OverrideFieldEditor: stub("field") } });
mock.module("@/features/core/messaging/components/common/EmbeddedInfoPopover", { namedExports: { EmbeddedInfoPopover: stub("embedded") } });
mock.module("@/features/core/messaging/components/common/LayoutPreview", { namedExports: { LayoutPreview: stub("preview") } });
// 種別とカテゴリーは読むだけの選び。偽物は選んでいる物の表示名を字で出す
mock.module("@/features/core/messaging/components/common/KindCategoryFields", {
  namedExports: {
    KindCategoryFields: stub("kind-category", (props) => {
      const kinds = props.kinds as { value: string; label: string }[];
      const categories = props.categories as { value: string; label: string }[];
      return `種類: ${kinds.find((item) => item.value === props.kind)?.label} / カテゴリー: ${categories.find((item) => item.value === props.category)?.label}`;
    }),
  },
});
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
const buttonOf = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((el) => el.textContent?.trim() === text) as HTMLButtonElement | undefined;
const click = (container: HTMLElement, text: string) => act(async () => buttonOf(container, text)!.click());

test("鍵が無い間は描かない / 欄を並べ、confirmOnClose に closeConfirm、鍵は出さない", async () => {
  const view = mountRoot();
  await view.draw(createElement(AdminMessageOverrideModal, props(true, null)));
  assert.equal(modalProps, null);
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  // 右 = 種別とカテゴリー(読むだけ)→ 今の経路の欄、左 = プレビュー、下の帯の左 = 埋め込み情報
  assert.deepEqual(parts(view.container), ["kind-category", "field", "field", "preview", "embedded"]);
  assert.match(view.container.textContent ?? "", /プレビュー/);
  assert.deepEqual(modalProps!.confirmOnClose, { enabled: true, message: "下書き" });
  // 連絡の名前・種別とカテゴリーの表示名で、鍵は出さない(D46)
  assert.equal(modalProps!.title, "文言を編集: 会員登録の完了");
  assert.match(view.container.textContent ?? "", /種類: 手続き通知 \/ カテゴリー: お手続き/);
  assert.doesNotMatch(view.container.textContent ?? "", /user\.welcome|transactional/);
  await view.unmount();
});

test("保存は 1 回(D132): 下書きが無ければ押せず、あれば数を出し、確かめると saveAll", async () => {
  const view = mountRoot();
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.equal(buttonOf(view.container, "保存")!.disabled, true);
  assert.equal(view.container.querySelector("[data-slot=override-pending-count]"), null);
  editor = { ...baseEditor(), hasDrafts: true, pendingCount: 2 };
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.equal(buttonOf(view.container, "保存")!.disabled, false);
  assert.equal(view.container.querySelector("[data-slot=override-pending-count]")?.textContent, "未保存の項目 2 件");
  await click(view.container, "ok:保存する");
  assert.deepEqual(events, ["saveAll"]);
  // 保存の間は押せない
  editor = { ...baseEditor(), hasDrafts: true, pendingCount: 2, isSaving: true };
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.equal(buttonOf(view.container, "保存")!.disabled, true);
  await view.unmount();
});

test("すべてデフォルトに戻す(D136): 変わる物が無ければ押せず、確かめると resetAll", async () => {
  const view = mountRoot();
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  const resetAll = () => view.container.querySelector("[data-slot=override-reset-all]") as HTMLButtonElement;
  assert.equal(resetAll().textContent, "すべてデフォルトに戻す");
  assert.equal(resetAll().disabled, true);
  editor = { ...baseEditor(), canResetAll: true };
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.equal(resetAll().disabled, false);
  await click(view.container, "ok:戻す");
  assert.deepEqual(events, ["resetAll"]);
  await view.unmount();
});

test("使えない行の数を出す / 取れない時は理由の文", async () => {
  editor = { ...baseEditor(), unusableCount: 1 };
  const view = mountRoot();
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.match(view.container.textContent ?? "", /使えない編集が 1 件あります/);
  editor = { ...baseEditor(), detail: null, isLoading: false, error: null };
  await view.draw(createElement(AdminMessageOverrideModal, props(true, "user.welcome")));
  assert.match(view.container.textContent ?? "", /この通知の文言は編集できません/);
  assert.equal(modalProps!.footer, null);
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
    items: [
      {
        key: "user.welcome",
        label: "会員登録の完了",
        kind: "transactional",
        category: "x",
        categoryLabel: "お手続き",
        channels: [{ key: "email", label: "メール" }],
        editableCount: 1,
        editedCount: 0,
        unusableCount: 0,
        codeChangedCount: 0,
      },
    ],
    error: null,
    isLoading: false,
    modal: { open: false, setOpen: () => {}, messageKey: null, openMessage: (key: string) => events.push(`open:${key}`) },
  };
  const view = mountRoot();
  await view.draw(createElement(AdminMessageOverrideList));
  await act(async () => (view.container.querySelector("[data-slot=override-message-row]") as HTMLButtonElement).click());
  assert.deepEqual(events, ["open:user.welcome"]);
  assert.match(view.container.textContent ?? "", /会員登録の完了/);
  // 種類の経路を並べる(J99。行の形は送信一覧と同じ MessageRowMeta)
  assert.match(view.container.querySelector("[aria-label=送信方法]")?.textContent ?? "", /メール/);
  assert.doesNotMatch(view.container.textContent ?? "", /user\.welcome|transactional/);
  assert.equal(view.container.querySelector("a"), null);
  await view.unmount();
});
