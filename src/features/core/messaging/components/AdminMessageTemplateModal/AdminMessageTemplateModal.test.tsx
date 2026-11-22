// テンプレートの作る・直すモーダルの入れ物と、一覧からの開き方の検査(jsdom の上で描く。hook・Modal・Popover・Dialog・部品は偽物)。
// - confirmOnClose に form の closeConfirm、form に onCreated・onChanged を渡す / 鍵の欄は無い / 書く欄に経路とプレビューの経路を渡す
// - 下の帯: 作る = 「保存」だけ / 直す = 「削除」(destructive の確かめ。消せたら閉じる、消せなければ閉じない)+「保存」
//   削除は書きかけの間は押せない・保存は書きかけの間だけ押せる / 保存の確かめで form.save
// - システムテンプレート = 帯なし・読むだけの一言・説明と中身の欄なし・バージョン履歴なし(D117)
// - 中身の入力と埋め込み情報はそろってから(D139): fieldsReady でない間は fieldsHint の 1 行、LayoutFields と埋め込み情報の吹き出しは出さない
// - バージョン履歴はボタンから重ねた Modal / ひな形を替える確かめの Dialog は pendingLayout の間だけ
// - 読み込み中・取れない時は普通の Modal(書く欄なし)
// - 一覧: 「新規作成」と行でモーダルの開き先を変える / 種別の絞り / システムテンプレートは既定で隠す
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
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

type Props = Record<string, unknown>;

const DELETE_TEXT = "テンプレートを削除します。送信の記録は残ります(どのテンプレートから送ったかは表示されなくなります)";
const events: string[] = [];
const OPTIONS = { layouts: [{ key: "basic", label: "基本", description: "基本のひな形", fields: [] }], categories: [] };
const TEMPLATE = { id: "t1", name: "春", system: false, currentVersion: 2, layout: "basic", values: {}, updatedAt: null };
const LAYOUT_FIELDS = [{ key: "title" }];
let modalState: Props = {};
let formState: Props = {};
let formArgs: Props | null = null;
const baseModal = (): Props => ({
  state: "ready",
  error: null,
  mode: "create",
  options: OPTIONS,
  template: null,
  versions: [],
  tab: "text",
  setTab: () => {},
  onCreated: () => {},
  onChanged: () => {},
  formKey: "1:new",
});
const baseForm = (): Props => ({
  mode: "create",
  fieldsReady: true,
  fieldsHint: null,
  system: false,
  readOnly: false,
  dirty: true,
  createdId: null,
  closeConfirm: { enabled: true, message: "書きかけ" },
  save: async () => void events.push("save"),
  remove: async () => {
    events.push("remove");
    return true;
  },
  fields: {
    name: "",
    setName: () => {},
    description: "",
    setDescription: () => {},
    kind: "announcement",
    setKind: () => {},
    kindOptions: [{ value: "announcement", label: "運営告知" }],
    category: "notice",
    setCategory: () => {},
    categoryChoices: [{ value: "notice", label: "お知らせ" }],
    layout: "basic",
    layoutOptions: [{ value: "basic", label: "基本", description: "基本のひな形" }],
    layoutLabel: "基本",
    requestLayoutChange: () => {},
    pendingLayout: null,
    confirmLayoutChange: () => void events.push("layout:confirm"),
    cancelLayoutChange: () => void events.push("layout:cancel"),
    channels: ["email"],
  },
  valuesForm: { control: { fake: true } },
  values: {},
  layoutFields: LAYOUT_FIELDS,
  catalog: [],
  unknownNames: [],
  varsEditor: {
    open: false,
    setOpen: () => {},
    openEditor: () => {},
    rows: [],
    updateRow: () => {},
    addRow: () => {},
    removeRow: () => {},
    apply: () => {},
    errors: [],
    count: 0,
  },
});
const withFields = (extra: Props): Props => ({ ...baseForm(), ...extra, fields: { ...(baseForm().fields as Props), ...((extra.fields as Props) ?? {}) } });

mock.module("@/features/core/messaging/hooks/useMessageTemplateModal", {
  namedExports: { useMessageTemplateModal: () => modalState },
});
mock.module("@/features/core/messaging/hooks/useMessageTemplateForm", {
  namedExports: {
    useMessageTemplateForm: (args: Props) => {
      formArgs = args;
      return formState;
    },
  },
});
mock.module("@/features/core/messaging/hooks/useLayoutPreview", {
  namedExports: {
    useLayoutPreview: () => ({
      layout: null,
      channels: [],
      channel: "email",
      setChannel: () => {},
      content: null,
      loading: false,
      error: null,
      incompleteChannels: [],
    }),
  },
});
mock.module("@/features/core/messaging/hooks/useVarTags", {
  namedExports: { useVarTags: () => ({ common: [], own: [], copy: () => {} }) },
});

// Modal は題ごとに最後の props を覚え、開いている間だけ中身と帯(footer)を描く
const modals = new Map<string, Props>();
mock.module("@/components/Overlays/Modal", {
  defaultExport: (props: Props) => {
    modals.set(String(props.title), props);
    return props.open
      ? createElement(
          "section",
          { "data-testid": "modal", "data-title": String(props.title) },
          props.children as never,
          props.footer ? createElement("footer", { "data-testid": "footer" }, props.footer as never) : null,
        )
      : null;
  },
});
let dialog: Props | null = null;
mock.module("@/components/Overlays/Dialog", {
  defaultExport: (props: Props) => {
    dialog = props;
    return props.open
      ? createElement(
          "section",
          { "data-testid": "dialog" },
          createElement("button", { type: "button", onClick: () => (props.onConfirm as () => void)() }, `confirm:${String(props.confirmLabel)}`),
        )
      : null;
  },
});
// ConfirmPopover は引き金と確かめのボタン(ok:<confirmLabel>)を並べ、props を確かめの文言ごとに覚える
const confirms = new Map<string, Props>();
mock.module("@/components/Overlays/Popover", {
  namedExports: {
    ConfirmPopover: (props: { trigger: ReactNode; confirmLabel: string; onConfirm: () => unknown }) => {
      confirms.set(props.confirmLabel, props as unknown as Props);
      return createElement(
        "div",
        null,
        props.trigger as never,
        createElement("button", { type: "button", onClick: () => props.onConfirm() }, `ok:${props.confirmLabel}`),
      );
    },
  },
});
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: { children?: unknown; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
  },
});
const selects = new Map<string, Props>();
const switches = new Map<string, Props>();
mock.module("@/components/Input/Input", {
  namedExports: {
    Input: (props: { id?: string }) => createElement("input", { id: props.id }),
  },
});
mock.module("@/components/Input/Textarea", {
  namedExports: {
    Textarea: (props: { id?: string }) => createElement("textarea", { id: props.id }),
  },
});
mock.module("@/components/Input/Select", {
  namedExports: {
    SelectInput: (props: Props) => {
      selects.set(String(props.id), props);
      return createElement("span", { id: props.id as string });
    },
  },
});
mock.module("@/components/Input/SwitchInput", {
  namedExports: {
    SwitchInput: (props: Props) => {
      switches.set(String(props.id), props);
      return createElement(
        "button",
        { type: "button", id: props.id as string, onClick: () => (props.onChange as (v: boolean) => void)(!props.value) },
        String(props.label),
      );
    },
  },
});
const parts = new Map<string, Props>();
const stub = (name: string) => {
  const Stub = (props: Props) => {
    parts.set(name, props);
    return createElement("div", { "data-part": name });
  };
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
mock.module("@/features/core/messaging/components/common/VarPopover", { namedExports: { VarPopover: stub("vars") } });
mock.module("@/features/core/messaging/components/common/KindCategoryFields", { namedExports: { KindCategoryFields: stub("kindCategory") } });
mock.module("@/features/core/messaging/components/common/LayoutFields", { namedExports: { LayoutFields: stub("layoutFields") } });
mock.module("@/features/core/messaging/components/common/LayoutPreview", { namedExports: { LayoutPreview: stub("preview") } });
mock.module("@/features/core/messaging/components/common/TemplateVarsModal", {
  namedExports: { TemplateVarsModal: stub("varsModal") },
});
mock.module("@/features/core/messaging/components/common/TemplateVersionList", { namedExports: { TemplateVersionList: stub("versions") } });

// 一覧の hook・カテゴリー(SWR)・新規作成のボタン(Link を引く)は偽物
let listState: Props = {};
mock.module("@/features/core/messaging/hooks/useAdminMessageTemplateList", {
  namedExports: { useAdminMessageTemplateList: () => listState },
});
mock.module("@/features/core/messaging/hooks/useAdminDispatchCategories", {
  namedExports: {
    useAdminDispatchCategories: () => ({ categories: [{ key: "notice", label: "お知らせ", kind: "announcement" }] }),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let AdminMessageTemplateModal: typeof import("./index").AdminMessageTemplateModal;
before(async () => {
  // crud の入口を本物のまま、描かせたくない物だけ差し替える(SUT を読む前に置く)
  const crudEntry = await import("@/lib/crud");
  mock.module("@/lib/crud", {
    namedExports: {
      ...crudEntry,
      CreateButton: (props: { label?: string; onClick?: () => void }) =>
        createElement("button", { type: "button", onClick: props.onClick }, props.label ?? "新規作成"),
    },
  });
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
  modals.clear();
  confirms.clear();
  selects.clear();
  switches.clear();
  parts.clear();
  dialog = null;
});

const render = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const footerOf = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-testid=footer]");
const buttonTexts = (scope: HTMLElement | null) => [...(scope?.querySelectorAll("button") ?? [])].map((b) => (b.textContent ?? "").trim());
const buttonOf = (scope: HTMLElement | null, label: string) =>
  [...(scope?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => (b.textContent ?? "").trim() === label);
const click = (scope: HTMLElement | null, label: string) => act(async () => buttonOf(scope, label)!.click());
const has = (container: HTMLElement, part: string) => container.querySelector(`[data-part=${part}]`) !== null;
const open = { open: true, onOpenChange: (v: boolean) => void events.push(`open:${v}`) };
const editModal = (template: Props = TEMPLATE) => ({ ...baseModal(), mode: "edit", template, formKey: "1:t1" });

test("作る: 帯は「保存」だけ、confirmOnClose・onCreated・onChanged を渡す、鍵の欄は無い", async () => {
  const view = await render(createElement(AdminMessageTemplateModal, open));
  const main = modals.get("テンプレートを作成")!;
  assert.ok(main, "作る時の題");
  assert.deepEqual(main.confirmOnClose, { enabled: true, message: "書きかけ" });
  assert.equal(formArgs!.onCreated, modalState.onCreated);
  assert.equal(formArgs!.onChanged, modalState.onChanged, "操作の後の知らせは一覧へ届く");
  assert.equal(formArgs!.options, OPTIONS);
  assert.equal(formArgs!.template, null);
  assert.equal(view.container.querySelector("#template-key"), null, "鍵は打たせない(サーバーが作る)");
  assert.ok(view.container.querySelector("#template-name"));
  assert.ok(view.container.querySelector("#template-description"));
  // 種別とカテゴリーは部品 KindCategoryFields に書く欄の選択肢を渡す
  const kindCategory = parts.get("kindCategory")!;
  assert.equal(kindCategory.categories, (formState.fields as Props).categoryChoices);
  assert.equal(kindCategory.category, "notice");
  assert.equal(kindCategory.disabled, false);
  // 中身の欄は書く欄の経路とプレビューの経路で描く
  const layoutFields = parts.get("layoutFields")!;
  assert.equal(layoutFields.fields, LAYOUT_FIELDS);
  assert.deepEqual(layoutFields.channels, ["email"]);
  assert.equal(layoutFields.activeChannel, "email");
  assert.equal(layoutFields.control, (formState.valuesForm as Props).control);
  // 作る時は版が無いのでバージョン履歴のボタンも重ねる Modal も無い
  assert.equal(buttonOf(view.container, "バージョン履歴"), undefined);
  assert.equal([...modals.keys()].some((t) => t.startsWith("バージョン履歴")), false);

  const footer = footerOf(view.container);
  assert.ok(footer);
  assert.ok(footer.querySelector("[data-part=vars]"), "そろっていれば埋め込み情報の吹き出しは帯の左");
  assert.deepEqual(buttonTexts(footer), ["保存", "ok:保存する"], "作る時は削除が無い");
  assert.equal(confirms.has("削除する"), false);
  assert.equal(buttonOf(footer, "保存")!.disabled, false, "書きかけがあれば保存を押せる");
  await click(footer, "ok:保存する");
  assert.deepEqual(events, ["save"]);
  await view.unmount();
});

test("直す: 帯は「削除」(destructive の確かめ)と「保存」。削除できたら閉じる", async () => {
  modalState = editModal();
  formState = withFields({ mode: "edit", dirty: false });
  const view = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  assert.ok(modals.get("テンプレートを編集: 春"));
  assert.equal(formArgs!.template, TEMPLATE);
  const footer = footerOf(view.container);
  assert.deepEqual(buttonTexts(footer), ["削除", "ok:削除する", "保存", "ok:保存する"]);
  const remove = confirms.get("削除する")!;
  assert.equal(remove.description, DELETE_TEXT);
  assert.equal(remove.confirmVariant, "destructive");
  assert.equal(buttonOf(footer, "削除")!.disabled, false, "書きかけが無ければ削除を押せる");
  assert.equal(buttonOf(footer, "保存")!.disabled, true, "書きかけが無ければ保存は押せない");
  await click(footer, "ok:削除する");
  assert.deepEqual(events, ["remove", "open:false"]);
  await view.unmount();
});

test("直す: 削除できなかった(false)時は閉じない / 書きかけの間は削除を押せない / 保存の確かめで save", async () => {
  modalState = editModal();
  formState = withFields({
    mode: "edit",
    dirty: true,
    remove: async () => {
      events.push("remove");
      return false;
    },
  });
  const view = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  const footer = footerOf(view.container);
  assert.equal(buttonOf(footer, "削除")!.disabled, true, "書きかけの間は削除を押せない");
  assert.equal(buttonOf(footer, "保存")!.disabled, false);
  await click(footer, "ok:削除する");
  assert.deepEqual(events, ["remove"], "消せなければモーダルは開いたまま");
  await click(footer, "ok:保存する");
  assert.deepEqual(events, ["remove", "save"]);
  await view.unmount();
});

test("直す: バージョン履歴はボタンから重ねた Modal で見る", async () => {
  modalState = editModal();
  formState = withFields({ mode: "edit", dirty: false });
  const view = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  const title = "バージョン履歴: 春";
  assert.equal(modals.get(title)!.open, false);
  assert.equal(has(view.container, "versions"), false);
  await click(view.container, "バージョン履歴");
  assert.equal(modals.get(title)!.open, true);
  const versions = parts.get("versions")!;
  assert.equal(versions.currentVersion, 2);
  assert.equal(versions.layouts, OPTIONS.layouts);
  await view.unmount();
});

test("システムテンプレート: 帯なし・読むだけの一言・説明と中身の欄なし・バージョン履歴なし(D117)", async () => {
  modalState = editModal({ ...TEMPLATE, system: true });
  formState = withFields({ mode: "edit", system: true, readOnly: true, dirty: false });
  const view = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  const main = modals.get("テンプレートを編集: 春")!;
  assert.equal(main.footer, null);
  assert.equal(footerOf(view.container), null);
  assert.match(view.container.textContent ?? "", /システムテンプレートは編集できません/);
  assert.equal(buttonOf(view.container, "バージョン履歴"), undefined);
  assert.equal([...modals.keys()].some((t) => t.startsWith("バージョン履歴")), false);
  assert.equal(view.container.querySelector("#template-description"), null);
  assert.equal(view.container.querySelector("[data-slot=template-values]"), null);
  assert.equal(has(view.container, "layoutFields"), false);
  // カテゴリーは「送信時に選ぶ」だけ(最初のカテゴリーを出さない)、触れない
  const kindCategory = parts.get("kindCategory")!;
  assert.deepEqual((kindCategory.categories as { label: string }[]).map((c) => c.label), ["送信時に選ぶ"]);
  assert.equal(kindCategory.disabled, true);
  assert.equal(selects.get("template-layout")!.disabled, true);
  await view.unmount();
});

test("D139: そろうまで中身の欄は fieldsHint の 1 行、LayoutFields と埋め込み情報の吹き出しは出さない", async () => {
  formState = withFields({ fieldsReady: false, fieldsHint: "先にカテゴリーを選んでください" });
  const view = await render(createElement(AdminMessageTemplateModal, open));
  const values = view.container.querySelector("[data-slot=template-values]");
  assert.equal(values?.textContent, "先にカテゴリーを選んでください");
  assert.equal(has(view.container, "layoutFields"), false);
  const footer = footerOf(view.container);
  assert.equal(footer!.querySelector("[data-part=vars]"), null);
  assert.deepEqual(buttonTexts(footer), ["保存", "ok:保存する"], "右の操作は残る");
  await view.unmount();

  // fieldsHint が無ければ既定の 1 行
  formState = withFields({ fieldsReady: false, fieldsHint: null });
  const fallback = await render(createElement(AdminMessageTemplateModal, open));
  assert.equal(fallback.container.querySelector("[data-slot=template-values]")?.textContent, "ひな形を選ぶと入力欄が出ます");
  await fallback.unmount();
});

test("ひな形を替える確かめ: pendingLayout の間だけ Dialog、確かめで confirmLayoutChange・閉じると cancelLayoutChange", async () => {
  const closed = await render(createElement(AdminMessageTemplateModal, open));
  assert.equal(dialog!.open, false);
  await closed.unmount();

  formState = withFields({ fields: { pendingLayout: "other" } });
  const view = await render(createElement(AdminMessageTemplateModal, open));
  assert.equal(dialog!.open, true);
  assert.equal(dialog!.confirmVariant, "destructive");
  await click(view.container.querySelector<HTMLElement>("[data-testid=dialog]"), "confirm:変更する");
  await act(async () => (dialog!.onOpenChange as (v: boolean) => void)(false));
  assert.deepEqual(events, ["layout:confirm", "layout:cancel"]);
  await view.unmount();
});

test("読み込み中・取れない時は普通の Modal(書く欄なし)", async () => {
  modalState = { ...baseModal(), state: "loading", options: null };
  const loading = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  assert.ok(modals.get("テンプレートを編集"));
  assert.equal(loading.container.querySelector("[data-slot=template-editor]"), null);
  assert.equal(footerOf(loading.container), null);
  assert.equal(formArgs, null, "書く欄の hook はまだ呼ばない");
  await loading.unmount();

  modalState = { ...baseModal(), state: "error", options: null, error: new Error("見つかりません") };
  const failed = await render(createElement(AdminMessageTemplateModal, { ...open, templateId: "t1" }));
  assert.match(failed.container.textContent ?? "", /見つかりません/);
  assert.equal(failed.container.querySelector("[data-slot=template-editor]"), null);
  await failed.unmount();
});

const ROW = {
  id: "t1",
  key: "tpl-abc",
  name: "春",
  description: null,
  system: false,
  kind: null,
  currentVersion: 1,
  category: "notice",
  categoryLabel: "お知らせ",
  createdAt: null,
  updatedAt: null,
};
const SYSTEM_ROW = { ...ROW, id: "s1", key: "system-blank", name: "白紙", system: true, kind: "announcement", category: "" };
const baseList = (): Props => ({
  kind: "",
  setKind: (v: string) => void events.push(`kind:${v}`),
  query: {
    items: [SYSTEM_ROW, ROW],
    isInitialLoading: false,
    isFetchingMore: false,
    hasMore: false,
    error: null,
    sentinelRef: () => {},
    retry: () => {},
  },
  modal: {
    open: false,
    setOpen: () => {},
    templateId: null,
    openNew: () => void events.push("new"),
    openTemplate: (id: string) => void events.push(`edit:${id}`),
    onChanged: () => {},
  },
});

test("一覧: 「新規作成」と行でモーダルの開き先を変える。鍵は出さない", async () => {
  const { AdminMessageTemplateList } = await import("../AdminMessageTemplateList");
  listState = baseList();
  const view = await render(createElement(AdminMessageTemplateList));
  await click(view.container, "新規作成");
  const row = [...view.container.querySelectorAll<HTMLButtonElement>("button")].find((b) => (b.textContent ?? "").includes("春"))!;
  await act(async () => row.click());
  assert.deepEqual(events, ["new", "edit:t1"]);
  assert.equal(view.container.querySelector("a"), null, "1 件の住所へのリンクは無い");
  assert.match(view.container.textContent ?? "", /お知らせ/);
  assert.match(view.container.textContent ?? "", /運営告知/, "種別の表示名はカテゴリーの受け口の種別から");
  assert.doesNotMatch(view.container.textContent ?? "", /tpl-abc|notice/, "鍵・カテゴリーの鍵は出さない");
  // モーダルへ開き先と操作の後の知らせを渡す
  const modal = listState.modal as Props;
  const main = modals.get("テンプレートを作成");
  assert.equal(main?.open, false);
  assert.equal(main?.onOpenChange, modal.setOpen);
  await view.unmount();
});

test("一覧: 種別の絞り(選択肢 = 送れるカテゴリーの種別、空 = すべて)/ システムテンプレートは既定で隠す", async () => {
  const { AdminMessageTemplateList } = await import("../AdminMessageTemplateList");
  listState = baseList();
  const view = await render(createElement(AdminMessageTemplateList));
  const kind = selects.get("template-filter-kind")!;
  assert.deepEqual(kind.options, [{ value: "announcement", label: "運営告知" }]);
  assert.equal(kind.value, "");
  assert.equal(kind.placeholder, "すべて");
  await act(async () => (kind.onChange as (v: unknown) => void)("announcement"));
  await act(async () => (kind.onChange as (v: unknown) => void)(null));
  assert.deepEqual(events, ["kind:announcement", "kind:"]);

  const rows = () => [...view.container.querySelectorAll("button")].map((b) => b.textContent ?? "");
  assert.equal(rows().some((t) => t.includes("白紙")), false, "システムテンプレートは既定で隠す");
  assert.equal(switches.get("template-filter-system")!.value, false);
  await click(view.container, "システムテンプレートを表示");
  assert.equal(rows().some((t) => t.includes("白紙")), true);
  assert.match(view.container.textContent ?? "", /送信時に選ぶ/, "システムテンプレートのカテゴリーは送信時に選ぶ");
  await view.unmount();
});
