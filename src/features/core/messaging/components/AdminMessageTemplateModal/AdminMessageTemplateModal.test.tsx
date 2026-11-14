// テンプレートの作る・直すモーダルの入れ物と、一覧からの開き方の検査(jsdom の上で描く。hook・Modal・部品は偽物)。
// - タブ: 作る = 文言・変数 / 直す = 文言・変数・版の履歴(版の履歴は下の帯を出さない)。タブは hook が持つ(value / onValueChange)
// - confirmOnClose に form の closeConfirm、作った後は form に onCreated を渡す
// - 下の帯: 作る = 「下書きを作る」だけ / 直す = 取り下げ・公開(ConfirmPopover)・保存 / 取り下げた = 帯の操作なし
// - 読み込み中・見つからない時は普通の Modal
// - 一覧: 「新しく作る」と行でモーダルの開き先を変える
// 実行: pnpm test src/features/core/messaging/components/AdminMessageTemplateModal/AdminMessageTemplateModal.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
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

const events: string[] = [];
const OPTIONS = { channels: [{ key: "email", label: "メール" }], categories: [{ key: "notice", label: "お知らせ" }], baseAllowedKeys: [] };
const TEMPLATE = { id: "t1", name: "春", status: "draft", currentVersion: null, hasUnpublishedChanges: true };
let modalState: Record<string, unknown> = {};
let formState: Record<string, unknown> = {};
let formArgs: Record<string, unknown> | null = null;
const baseModal = () => ({
  state: "ready",
  error: null,
  mode: "create",
  options: OPTIONS,
  template: null,
  versions: [],
  tab: "text",
  setTab: (v: string) => events.push(`tab:${v}`),
  onCreated: () => {},
  formKey: "1:new",
});
const baseForm = () => ({
  archived: false,
  dirty: true,
  canPublish: false,
  allowedKeys: [],
  unknownKeys: [],
  closeConfirm: { enabled: true, message: "書きかけ" },
  save: async () => events.push("save"),
  publish: async () => events.push("publish"),
  archive: async () => events.push("archive"),
  fields: {
    key: "",
    setKey: () => {},
    name: "",
    setName: () => {},
    description: "",
    setDescription: () => {},
    category: "notice",
    setCategory: () => {},
    channels: [],
    content: {},
    setChannelContent: () => {},
    variables: [],
    setVariables: () => {},
  },
});
mock.module("@/features/core/messaging/hooks/useMessageTemplateModal", {
  namedExports: { useMessageTemplateModal: () => modalState },
});
mock.module("@/features/core/messaging/hooks/useMessageTemplateForm", {
  namedExports: {
    useMessageTemplateForm: (args: Record<string, unknown>) => {
      formArgs = args;
      return formState;
    },
    emptyChannelContent: () => ({}),
  },
});
let tabbed: Record<string, unknown> | null = null;
let plain: Record<string, unknown> | null = null;
mock.module("@/components/Overlays/TabbedModal", {
  defaultExport: (props: Record<string, unknown>) => {
    tabbed = props;
    const tabs = props.tabs as { value: string; content: ReactNode; footer?: ReactNode }[];
    const active = tabs.find((t) => t.value === props.value) ?? tabs[0];
    const footer = active.footer === undefined ? props.footer : active.footer;
    return props.open ? createElement("section", { "data-testid": "tabbed" }, active.content as never, footer as never) : null;
  },
});
mock.module("@/components/Overlays/Modal", {
  defaultExport: (props: Record<string, unknown>) => {
    plain = props;
    return props.open ? createElement("section", { "data-testid": "modal" }, props.children as never) : null;
  },
});
mock.module("@/components/Overlays/Popover", {
  namedExports: {
    ConfirmPopover: (props: { trigger: ReactNode; confirmLabel: string; onConfirm: () => void }) =>
      createElement("div", null, props.trigger as never, createElement("button", { type: "button", onClick: props.onConfirm }, `ok:${props.confirmLabel}`)),
  },
});
mock.module("@/components/Form/Button", {
  namedExports: {
    Button: (props: { children?: unknown; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
  },
});
mock.module("@/components/Form/Input/Manual", {
  namedExports: { Input: () => createElement("input"), Textarea: () => createElement("textarea"), SelectInput: () => createElement("span") },
});
const stub = (name: string) => {
  const Stub = () => createElement("div", { "data-part": name });
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
mock.module("@/features/core/messaging/components/common/AllowedKeysHint", { namedExports: { AllowedKeysHint: stub("keys") } });
mock.module("@/features/core/messaging/components/common/TemplateChannelFields", { namedExports: { TemplateChannelFields: stub("channel") } });
mock.module("@/features/core/messaging/components/common/TemplateVariablesEditor", { namedExports: { TemplateVariablesEditor: stub("variables") } });
mock.module("@/features/core/messaging/components/common/TemplateVersionList", { namedExports: { TemplateVersionList: stub("versions") } });
mock.module("@/features/core/messaging/components/common/TemplateStatusBadge", {
  namedExports: { TemplateStatusBadge: stub("status"), TEMPLATE_STATUS_DISPLAY: { draft: { label: "下書き" } } },
});
let listState: Record<string, unknown> = {};
mock.module("@/features/core/messaging/hooks/useAdminMessageTemplateList", {
  namedExports: { useAdminMessageTemplateList: () => listState },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let AdminMessageTemplateModal: typeof import("./index").AdminMessageTemplateModal;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ AdminMessageTemplateModal } = await import("./index"));
});
after(() => dom.window.close());
beforeEach(() => {
  events.length = 0;
  modalState = baseModal();
  formState = baseForm();
  formArgs = null;
  tabbed = null;
  plain = null;
});

const render = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const texts = (container: HTMLElement) => [...container.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim());
const tabValues = () => (tabbed!.tabs as { value: string }[]).map((t) => t.value);
const open = { open: true, onOpenChange: (v: boolean) => events.push(`open:${v}`) };

test("作る: 文言・変数のタブ、帯は「下書きを作る」、confirmOnClose と onCreated を渡す", async () => {
  const view = await render(createElement(AdminMessageTemplateModal, open));
  assert.deepEqual(tabValues(), ["text", "variables"]);
  assert.deepEqual(tabbed!.confirmOnClose, { enabled: true, message: "書きかけ" });
  assert.equal(tabbed!.value, "text");
  assert.equal(formArgs!.onCreated, modalState.onCreated);
  assert.deepEqual(texts(view.container), ["下書きを作る"]);
  await act(async () => (view.container.querySelector("button") as HTMLButtonElement).click());
  assert.deepEqual(events, ["save"]);
  (tabbed!.onValueChange as (v: string) => void)("variables");
  assert.deepEqual(events.at(-1), "tab:variables");
  await view.unmount();
});

test("直す: 版の履歴のタブ(帯なし)、取り下げ・公開は ConfirmPopover", async () => {
  modalState = { ...baseModal(), mode: "edit", template: TEMPLATE };
  formState = { ...baseForm(), dirty: false, canPublish: true };
  const view = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  assert.deepEqual(tabValues(), ["text", "variables", "versions"]);
  assert.equal((tabbed!.tabs as { value: string; footer?: unknown }[])[2].footer, null);
  assert.deepEqual(texts(view.container), ["取り下げ", "ok:取り下げる", "公開", "ok:公開する", "保存"]);
  const click = async (label: string) =>
    act(async () => [...view.container.querySelectorAll("button")].find((b) => b.textContent === label)!.click());
  await click("ok:取り下げる");
  await click("ok:公開する");
  assert.deepEqual(events, ["archive", "publish"]);
  await view.unmount();
});

test("取り下げた: 帯の操作なし / 読み込み中・見つからないは普通の Modal", async () => {
  modalState = { ...baseModal(), mode: "edit", template: { ...TEMPLATE, status: "archived" } };
  formState = { ...baseForm(), archived: true, dirty: false };
  const view = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  assert.deepEqual(texts(view.container), []);
  await view.unmount();

  modalState = { ...baseModal(), state: "loading", options: null };
  const loading = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  assert.ok(plain);
  assert.equal(loading.container.querySelector("[data-testid=tabbed]"), null);
  await loading.unmount();

  modalState = { ...baseModal(), state: "missing" };
  const missing = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  assert.match(missing.container.textContent ?? "", /見つかりません/);
  await missing.unmount();
});

test("一覧: 「新しく作る」と行でモーダルの開き先を変える", async () => {
  const { AdminMessageTemplateList } = await import("../AdminMessageTemplateList");
  listState = {
    status: "",
    setStatus: () => {},
    query: { items: [{ id: "t1", key: "spring", name: "春", status: "draft", currentVersion: null, category: "notice", createdAt: null, updatedAt: null }], isInitialLoading: false, isFetchingMore: false, hasMore: false, error: null, sentinelRef: () => {}, retry: () => {} },
    modal: { open: false, setOpen: () => {}, templateId: null, openNew: () => events.push("new"), openTemplate: (id: string) => events.push(`edit:${id}`) },
  };
  const view = await render(createElement(AdminMessageTemplateList));
  const buttons = [...view.container.querySelectorAll("button")];
  await act(async () => buttons.find((b) => b.textContent === "新しく作る")!.click());
  await act(async () => buttons.find((b) => (b.textContent ?? "").includes("春"))!.click());
  assert.deepEqual(events, ["new", "edit:t1"]);
  assert.equal(view.container.querySelector("a"), null, "1 件の住所へのリンクは無い");
  await view.unmount();
});
