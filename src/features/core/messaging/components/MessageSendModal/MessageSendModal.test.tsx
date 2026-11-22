// 送るモーダルの入れ物と、開く口の検査(jsdom の上で描く。hook・Modal・Dialog・部品は偽物)。
// - 入れ物: ボタンで開く / 書く段は部品を並べる(左右 2 つのペイン: 操作 = 種別とカテゴリー → 送信方法 → 宛先 → レイアウト → テンプレート(門 messagingTemplates が開の時だけ)→ 内容 → 送信日時、
//   プレビュー = LayoutPreview。種別を選ぶまでは案内だけ)/ テンプレートを読み込んだ直後は専用の埋め込み情報の入力と『文面を直す』だけ /
//   予約は bulk で出さない / confirmOnClose に hook の closeConfirm を渡す / 下の帯のボタンで hook を呼ぶ
// - 確認の段は「送信する」(予約なら「予約する」)で confirmSend、「戻る」で backToEdit、上限を超えたら送れない / 結果の段(送信へのリンクは dispatchDetailHref)
// - 手で直した書きかけの上に読み込む時は Dialog で確かめる(置き換える → confirmLoad、閉じる → cancelLoad)。レイアウトを替える時も同じ(confirmLayout / cancelLayout)
// - 開く口: 送信の一覧の「新規送信」は門 messagingBroadcast が開の時だけ
// 実行: pnpm test src/features/core/messaging/components/MessageSendModal/MessageSendModal.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { MessageSendModalState } from "@/features/core/messaging/hooks/useMessageSendModal";
import type { SendTemplateTextState } from "@/features/core/messaging/hooks/useSendTemplateText";

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

type Over<T> = Partial<Record<keyof T, unknown>>;

const events: string[] = [];
let modalConfirm: unknown = null;

/** hook useSendTemplateText の偽物(レイアウトから書く = 全文を書ける形) */
const baseText = () =>
  ({
    state: {
      source: { type: "layout", layout: "simple", label: "シンプル" },
      layout: "simple",
      start: {},
      versionValues: null,
      unlocked: true,
      varDeclarations: [],
      vars: {},
    },
    source: { type: "layout", layout: "simple", label: "シンプル" },
    layout: { key: "simple", label: "シンプル", fields: {} },
    fields: {},
    control: {},
    locked: false,
    values: {},
    edited: false,
    missingVars: [],
    canUpdateTemplate: false,
    isUpdatingTemplate: false,
    unlock: () => events.push("unlock"),
    setVars: () => {},
  }) satisfies Over<SendTemplateTextState>;

/** hook useMessageSendModal の偽物 */
const baseState = () =>
  ({
    open: true,
    setOpen: (v: boolean) => events.push(`open:${v}`),
    step: "edit",
    optionsLoaded: true,
    optionsError: null,
    sameAsNote: null,
    closeConfirm: { enabled: true, message: "書きかけ" },
    kinds: [{ key: "notice", label: "お知らせ" }],
    kind: "notice",
    setKind: () => {},
    categories: [{ key: "notice", label: "お知らせ" }],
    category: "notice",
    setCategory: () => {},
    target: { type: "all", roles: [], groupId: "", userIds: [] },
    setTarget: () => {},
    allowedTargetTypes: ["all", "role", "group", "users"],
    roles: [],
    groups: [],
    groupsEnabled: false,
    targetNote: null,
    templatesAvailable: true,
    pickerTemplates: [{ id: "t1", name: "春", currentVersion: 2 }],
    currentLayout: { label: "シンプル" },
    blank: { key: "simple", label: "シンプル" },
    layoutChoices: [
      { key: "simple", label: "シンプル" },
      { key: "notice", label: "汎用のお知らせ" },
    ],
    layoutKey: "simple",
    chooseLayout: (key: string) => events.push(`layout:${key}`),
    pendingLayout: null,
    confirmLayout: () => events.push("confirmLayout"),
    cancelLayout: () => events.push("cancelLayout"),
    loadedTemplate: null,
    text: baseText(),
    layoutPreview: {
      layout: null,
      channels: ["email"],
      channel: "email",
      setChannel: () => {},
      content: null,
      loading: false,
      error: null,
      incompleteChannels: [],
    },
    varCatalog: [],
    loadTemplate: () => {},
    unloadTemplate: () => {},
    pendingLoad: null,
    confirmLoad: () => events.push("confirmLoad"),
    cancelLoad: () => events.push("cancelLoad"),
    updateTemplate: async () => ({ version: 3, unchanged: false }),
    channels: [
      { key: "email", label: "メール", on: true },
      { key: "inApp", label: "お知らせ", on: false },
    ],
    sendChannels: ["email"],
    toggleChannel: () => {},
    showSchedule: true,
    scheduleMode: "now",
    scheduledAt: "",
    scheduleError: null,
    scheduleNote: "注記",
    setScheduleMode: () => {},
    setScheduledAt: () => {},
    contentError: null,
    targetError: null,
    canSend: true,
    preview: null,
    estimate: { count: 5 },
    estimateOverLimit: false,
    result: null,
    isPreviewing: false,
    isTesting: false,
    isSending: false,
    closePreview: () => {},
    previewLayoutFields: null,
    runPreview: async () => void events.push("preview"),
    sendTest: async () => void events.push("test"),
    requestConfirm: async () => void events.push("confirm"),
    backToEdit: () => events.push("back"),
    confirmSend: async () => {
      events.push("send");
      return { kind: "send", result: { status: "queued" } };
    },
  }) satisfies Over<MessageSendModalState>;

let state: Record<string, unknown> = {};
const make = (over: Over<MessageSendModalState> = {}) => ({ ...baseState(), ...over });

mock.module("@/features/core/messaging/hooks/useMessageSendModal", {
  namedExports: { useMessageSendModal: () => state as unknown as MessageSendModalState },
});
mock.module("@/features/core/messaging/hooks/useVarTags", {
  namedExports: { useVarTags: () => ({ common: [], own: [], copy: async () => {} }) },
});
mock.module("@/components/Overlays/Modal", {
  defaultExport: ({ open, title, children, footer, confirmOnClose }: Record<string, unknown>) => {
    modalConfirm = confirmOnClose;
    return open ? createElement("section", { "data-testid": "modal" }, title as never, children as never, footer as never) : null;
  },
});
// Dialog は 3 つ(読み込みの上書き・レイアウトの切り替え・テンプレートの更新)。題で分けて props を控える
const dialogs = new Map<string, Record<string, unknown>>();
const FakeDialog = (props: Record<string, unknown>) => {
  dialogs.set(String(props.title), props);
  return props.open ? createElement("aside", { "data-testid": "dialog" }, props.title as never) : null;
};
mock.module("@/components/Overlays/Dialog", { defaultExport: FakeDialog });
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: { children?: unknown; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
  },
});
mock.module("@/components/Button/LinkButton", {
  namedExports: {
    LinkButton: (props: { href: string; children?: unknown }) => createElement("a", { href: props.href }, props.children as never),
  },
});
// 「新規送信」の CreateButton(押すと onClick)

// 部品は偽物: data-part に名前を出し、最後に受けた props を控える(open を受ける部品は閉じている間は描かない)
const lastProps = new Map<string, Record<string, unknown>>();
const stub = (name: string) => {
  const Stub = (props: Record<string, unknown>) => {
    lastProps.set(name, props);
    if ("open" in props && !props.open) return null;
    return createElement("div", { "data-part": name });
  };
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
const COMMON = "@/features/core/messaging/components/common";
mock.module(`${COMMON}/KindCategoryFields`, { namedExports: { KindCategoryFields: stub("kindCategory") } });
mock.module(`${COMMON}/SendCategoryChannels`, { namedExports: { SendCategoryChannels: stub("channels") } });
mock.module(`${COMMON}/SendTargetPicker`, { namedExports: { SendTargetPicker: stub("target") } });
mock.module(`${COMMON}/SendLayoutPicker`, { namedExports: { SendLayoutPicker: stub("layout") } });
mock.module(`${COMMON}/SendTemplatePicker`, {
  namedExports: { SendTemplatePicker: stub("template"), SendVarInputs: stub("vars") },
});
mock.module(`${COMMON}/LayoutFields`, { namedExports: { LayoutFields: stub("layoutFields") } });
mock.module(`${COMMON}/LayoutPreview`, { namedExports: { LayoutPreview: stub("layoutPreview") } });
mock.module(`${COMMON}/SendSchedule`, { namedExports: { SendSchedule: stub("schedule") } });
mock.module(`${COMMON}/SendConfirmView`, { namedExports: { SendConfirmView: stub("confirm"), SendResultView: stub("result") } });
mock.module(`${COMMON}/SampleForYouModal`, { namedExports: { SampleForYouModal: stub("sampleForYou") } });
mock.module(`${COMMON}/VarPopover`, { namedExports: { VarPopover: stub("varPopover") } });

// 送信の一覧(開く口)の周り: 絞り込みの入力・SWR・URL・一括操作・詳細のモーダルは jsdom で動かさない偽物
mock.module("@/components/Input/DateInput", {
  namedExports: {
    DateInput: () => createElement("input"),
  },
});
mock.module("@/components/Input/Input", {
  namedExports: {
    Input: () => createElement("input"),
  },
});
mock.module("@/components/Input/Select", {
  namedExports: {
    SelectInput: () => createElement("span"),
  },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });
let broadcastOpen = true;
mock.module("@/featureGate/client", { namedExports: { useGate: () => ({ enabled: () => broadcastOpen }) } });
mock.module("next/navigation", {
  namedExports: { useSearchParams: () => new URLSearchParams(), usePathname: () => "/admin/messaging" },
});
mock.module("@/lib/unsavedGuard", {
  namedExports: { useRouter: () => ({ back: () => {}, replace: () => {}, push: () => {} }), useUnsavedGuard: () => {} },
});
mock.module("@/features/core/messaging/hooks/useAdminDispatches", {
  namedExports: {
    useAdminDispatches: () => ({
      items: [],
      isInitialLoading: false,
      isFetchingMore: false,
      hasMore: false,
      error: null,
      sentinelRef: () => {},
      retry: () => {},
      revalidate: () => {},
    }),
  },
});
mock.module("@/features/core/messaging/hooks/useAdminDispatchCategories", {
  namedExports: { useAdminDispatchCategories: () => ({ categories: [], loaded: true, error: null, isLoading: false, optionsOf: () => [], labelOf: () => null }) },
});
mock.module("@/features/core/messaging/components/AdminDispatchDetailModal", { namedExports: { AdminDispatchDetailModal: () => null } });
mock.module("@/features/core/messaging/extensions/adminBulkActions", { namedExports: { adminBulkActions: {} } });
mock.module("@/lib/tableSuite", {
  namedExports: {
    selectBulkActions: (items: unknown[]) => items,
    BulkActionItems: () => null,
    RecordSelectionList: () => null,
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let MessageSendModal: typeof import("./index").MessageSendModal;
before(async () => {
  // crud の入口を本物のまま、描かせたくない物だけ差し替える(SUT を読む前に置く)
  const crudEntry = await import("@/lib/crud");
  mock.module("@/lib/crud", {
    namedExports: {
      ...crudEntry,
      CreateButton: (props: { label?: string; disabled?: boolean; onClick?: () => void }) =>
        createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.label),
    },
  });
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ MessageSendModal } = await import("./index"));
});
after(() => dom.window.close());
beforeEach(() => {
  events.length = 0;
  state = make();
  broadcastOpen = true;
  lastProps.clear();
  dialogs.clear();
  modalConfirm = null;
});

const render = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(text)) as HTMLButtonElement | undefined;
/** 文言がちょうど一致するボタン(「送信する」と「新規送信」を分ける) */
const exact = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === text) as HTMLButtonElement | undefined;
const parts = (container: HTMLElement) => [...container.querySelectorAll("[data-part]")].map((el) => el.getAttribute("data-part"));
const NEW = { type: "new" } as const;

test("書く段: 部品を並べ、confirmOnClose に closeConfirm、ボタンで hook を呼ぶ", async () => {
  const view = await render(createElement(MessageSendModal, { mode: NEW }));
  // 並び(D110 D115 D118 D195): 種別とカテゴリー → 送信方法 → 宛先 → レイアウト → テンプレート → 内容(白紙 = レイアウトの欄)→ 送信日時、
  // プレビューのペイン → 下の帯(埋め込み情報の吹き出し)。「あなた宛ての表示例」は表示例が無い間は出さない
  assert.deepEqual(parts(view.container), ["kindCategory", "channels", "target", "layout", "template", "layoutFields", "schedule", "layoutPreview", "varPopover"]);
  assert.equal(lastProps.get("target")!.kind, "select");
  assert.deepEqual(lastProps.get("template")!.templates, [{ id: "t1", name: "春", currentVersion: 2 }]);
  assert.equal(lastProps.get("template")!.loaded, null);
  assert.deepEqual(lastProps.get("layout")!.layouts, [
    { key: "simple", label: "シンプル" },
    { key: "notice", label: "汎用のお知らせ" },
  ]);
  assert.equal(lastProps.get("layout")!.value, "simple");
  (lastProps.get("layout")!.onChange as (key: string) => void)("notice");
  assert.deepEqual(events.splice(0), ["layout:notice"], "レイアウトの選択は hook の chooseLayout");
  assert.equal(dialogs.get("テンプレートを読み込みますか")!.open, false, "上書きの確かめは読み込みを待つ時だけ");
  assert.equal(dialogs.get("レイアウトを替えますか")!.open, false, "消す確かめは切り替えを待つ時だけ");
  assert.deepEqual(modalConfirm, { enabled: true, message: "書きかけ" });
  await act(async () => button(view.container, "新規送信")!.click());
  await act(async () => button(view.container, "あなた宛ての表示例")!.click());
  await act(async () => button(view.container, "自分にテスト送信")!.click());
  await act(async () => button(view.container, "確認に進む")!.click());
  assert.deepEqual(events, ["open:true", "preview", "test", "confirm"]);
  await view.unmount();

  // 種別を選ぶまではプレビューは案内だけ
  state = make({ kind: "" });
  const noKind = await render(createElement(MessageSendModal, { mode: NEW }));
  assert.equal(noKind.container.querySelector("[data-part=layoutPreview]"), null);
  assert.match(noKind.container.textContent ?? "", /種別を選ぶとプレビューが出ます/);
  await noKind.unmount();

  // 門 messagingTemplates が閉 = テンプレートの行ごと出さない(レイアウトから書くだけ)
  state = make({ templatesAvailable: false });
  const noTemplates = await render(createElement(MessageSendModal, { mode: NEW }));
  assert.deepEqual(parts(noTemplates.container), ["kindCategory", "channels", "target", "layout", "layoutFields", "schedule", "layoutPreview", "varPopover"]);
  await noTemplates.unmount();
});

test("テンプレートを読み込んだ直後: 専用の埋め込み情報の入力と『文面を直す』だけ(レイアウトの欄・吹き出しは出さない)", async () => {
  const declarations = [{ key: "discount", alias: "割引", type: "number", required: true }];
  state = make({
    loadedTemplate: { type: "template", id: "t1", name: "春", version: 2 },
    text: {
      ...baseText(),
      state: { ...baseText().state, source: { type: "template", id: "t1", name: "春", version: 2 }, unlocked: false, varDeclarations: declarations, vars: { discount: "10" } },
      locked: true,
      missingVars: [{ key: "discount" }],
    },
  });
  const view = await render(createElement(MessageSendModal, { mode: NEW }));
  assert.deepEqual(parts(view.container), ["kindCategory", "channels", "target", "layout", "template", "vars", "schedule", "layoutPreview"]);
  assert.deepEqual(lastProps.get("template")!.loaded, { type: "template", id: "t1", name: "春", version: 2, edited: false });
  assert.deepEqual(lastProps.get("vars")!.declarations, declarations);
  assert.deepEqual(lastProps.get("vars")!.values, { discount: "10" });
  assert.deepEqual(lastProps.get("vars")!.missing, ["discount"]);
  assert.match(view.container.textContent ?? "", /文面はテンプレートのまま/);
  await act(async () => button(view.container, "文面を直す")!.click());
  assert.deepEqual(events, ["unlock"]);
  await view.unmount();
});

test("bulk は宛先 = 選んだ記録の数、予約を出さない", async () => {
  state = make({ showSchedule: false });
  const view = await render(
    createElement(MessageSendModal, { mode: { type: "bulk", target: "t", recordIds: ["r1", "r2"], recordNoun: "記録" } }),
  );
  assert.deepEqual(parts(view.container), ["kindCategory", "channels", "target", "layout", "template", "layoutFields", "layoutPreview", "varPopover"]);
  assert.equal(lastProps.get("target")!.kind, "bulk");
  assert.equal(lastProps.get("target")!.recordCount, 2);
  assert.equal(lastProps.get("target")!.recordNoun, "記録");
  assert.ok(button(view.container, "一括送信"), "開くボタンの既定の文言");
  await view.unmount();
});

test("確認の段: 送信する → confirmSend、戻る → backToEdit / 予約 / 上限超え / 結果の段", async () => {
  state = make({ step: "confirm" });
  const view = await render(createElement(MessageSendModal, { mode: NEW }));
  assert.deepEqual(parts(view.container), ["confirm"]);
  assert.ok((view.container.textContent ?? "").includes("新規送信(確認)"), "確認の段の題");
  const confirm = lastProps.get("confirm")!;
  assert.deepEqual(confirm.estimate, { count: 5 });
  assert.equal(confirm.bulk, null);
  assert.equal(confirm.scheduledAt, null);
  assert.equal(confirm.templateVersion, null);
  assert.deepEqual(confirm.channels, ["メール"], "オンの送信チャンネルだけ");
  assert.equal(confirm.categoryLabel, "お知らせ");
  await act(async () => button(view.container, "戻る")!.click());
  await act(async () => exact(view.container, "送信する")!.click());
  assert.deepEqual(events, ["back", "send"]);
  await view.unmount();

  // 予約: ボタンは「予約する」、確認の部品に時刻
  state = make({ step: "confirm", scheduleMode: "at", scheduledAt: "2026-12-01T00:00:00.000Z" });
  const at = await render(createElement(MessageSendModal, { mode: NEW }));
  assert.ok(exact(at.container, "予約する"));
  assert.equal(exact(at.container, "送信する"), undefined);
  assert.equal(lastProps.get("confirm")!.scheduledAt, "2026-12-01T00:00:00.000Z");
  await at.unmount();

  // 見込みが人数の上限を超えた = 送るを押せない(理由は確認の部品が出す)
  state = make({ step: "confirm", estimateOverLimit: true });
  const over = await render(createElement(MessageSendModal, { mode: NEW }));
  assert.equal(exact(over.container, "送信する")?.disabled, true);
  await over.unmount();

  // 結果の段: 送信へのリンクは一覧の上の詳細(?dispatch=<id>)
  events.length = 0;
  state = make({ step: "done", result: { kind: "send", result: { status: "queued", queuedCount: 0, dispatchId: "d1" } } });
  const done = await render(createElement(MessageSendModal, { mode: NEW }));
  assert.deepEqual(parts(done.container), ["result"]);
  const result = lastProps.get("result")!;
  assert.equal(result.status, "queued");
  assert.equal(result.queuedCount, 0);
  assert.equal(result.dispatchHref, "/admin/messaging?dispatch=d1");
  assert.equal(result.afterSend, null);
  await act(async () => exact(done.container, "閉じる")!.click());
  assert.deepEqual(events, ["open:false"]);
  await done.unmount();

  // bulk の結果: 数は counts、後処理と記録の名詞を渡す。一覧の住所を替えればリンクもそこ
  state = make({
    step: "done",
    result: { kind: "bulk", result: { status: "processing", counts: { queuedCount: 3 }, dispatchId: "d2", afterSend: { ok: true } } },
  });
  const bulkDone = await render(
    createElement(MessageSendModal, {
      mode: { type: "bulk", target: "t", recordIds: ["r1"], recordNoun: "記録" },
      dispatchBasePath: "/admin/other",
    }),
  );
  const bulkResult = lastProps.get("result")!;
  assert.equal(bulkResult.queuedCount, 3);
  assert.deepEqual(bulkResult.afterSend, { ok: true });
  assert.equal(bulkResult.recordNoun, "記録");
  assert.equal(bulkResult.dispatchHref, "/admin/other?dispatch=d2");
  await bulkDone.unmount();
});

test("開く口: 送信の一覧の「新規送信」は門 messagingBroadcast が開の時だけ", async () => {
  const { AdminDispatchList, AdminDispatchSendButton } = await import("../AdminDispatchList");
  state = make({ open: false });
  const open = await render(createElement(AdminDispatchList));
  assert.ok(button(open.container, "新規送信"));
  await open.unmount();
  const openButton = await render(createElement(AdminDispatchSendButton));
  assert.ok(button(openButton.container, "新規送信"));
  await openButton.unmount();
  broadcastOpen = false;
  const closed = await render(createElement(AdminDispatchList));
  assert.equal(button(closed.container, "新規送信"), undefined);
  await closed.unmount();
  const closedButton = await render(createElement(AdminDispatchSendButton));
  assert.equal(button(closedButton.container, "新規送信"), undefined);
  await closedButton.unmount();
});

test("手で直した書きかけの上に読み込む時は Dialog で確かめる", async () => {
  state = make({ pendingLoad: "t1" });
  const view = await render(createElement(MessageSendModal, { mode: NEW }));
  const dialog = dialogs.get("テンプレートを読み込みますか")!;
  assert.equal(dialog.open, true);
  assert.equal(dialog.confirmLabel, "置き換える");
  await act(async () => (dialog.onConfirm as () => void)());
  await act(async () => (dialog.onOpenChange as (v: boolean) => void)(true));
  await act(async () => (dialog.onOpenChange as (v: boolean) => void)(false));
  assert.deepEqual(events, ["confirmLoad", "cancelLoad"], "開いたままの知らせでは取り消さない");
  await view.unmount();
});

test("レイアウトを替える時、書きかけがあれば Dialog で確かめる", async () => {
  state = make({ pendingLayout: "notice" });
  const view = await render(createElement(MessageSendModal, { mode: NEW }));
  const dialog = dialogs.get("レイアウトを替えますか")!;
  assert.equal(dialog.open, true);
  assert.equal(dialog.confirmLabel, "替える");
  await act(async () => (dialog.onConfirm as () => void)());
  await act(async () => (dialog.onOpenChange as (v: boolean) => void)(true));
  await act(async () => (dialog.onOpenChange as (v: boolean) => void)(false));
  assert.deepEqual(events, ["confirmLayout", "cancelLayout"], "開いたままの知らせでは取り消さない");
  await view.unmount();
});
