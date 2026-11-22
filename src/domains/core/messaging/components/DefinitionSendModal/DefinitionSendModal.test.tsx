// 定義連絡の汎用の送るモーダルの入れ物の検査(jsdom の上で描く。hook・Modal・部品は偽物)。
// - 門が閉の broadcast(hook の available = false)は何も描かない
// - 書く段: 連絡定義が 1 つなら表示名、2 つ以上は選ぶ欄(hook の chooseDefinition)/ 送信方法は hook の channels(locked 込み)/
//   宛先は記録なら選んだ記録の数と名詞、broadcast なら選ぶ欄(許す種類)/ 管理者の値 / 直せる欄 / required は文面の箱なし / 予約は broadcast だけ / 説明の文
// - 下の帯のボタンで hook の表示例・テスト・確認を呼ぶ。確認の段は DefinitionSendConfirm(確認の文・宛先の文)と送る
// - 結果の段: SendResultView と送信の結果 SendResult(useSendResults の物)
// - definitionRecipientsText: 記録 / 全員 / ロール / グループ
// 実行: pnpm test src/domains/core/messaging/components/DefinitionSendModal/DefinitionSendModal.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
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

const events: string[] = [];
const DEF = {
  key: "bankTransferReview.statement",
  label: "振込の明細",
  layout: { key: "simple", label: "シンプル", version: 1, fields: {} },
  editableFields: ["title"],
  values: {},
  adminVars: [],
  channels: { email: "free", inApp: "on" },
  initialChannels: ["inApp"],
  required: false,
  adminTargets: ["records"],
  adminText: { description: "明細を送ります", confirm: "送ると取り消せません" },
};
const baseState = () => ({
  entry: { type: "records", recordTarget: "bankTransferReview.reviews", recordIds: ["r1", "r2"] },
  available: true,
  open: true,
  setOpen: (v: boolean) => events.push(`open:${v}`),
  step: "edit",
  optionsLoaded: true,
  optionsError: null,
  closeConfirm: { enabled: false, message: "x" },
  definitions: [DEF],
  definition: DEF as typeof DEF | null,
  chooseDefinition: (key: string) => events.push(`choose:${key}`),
  recordNoun: "振込レビュー",
  recordCount: 2,
  channels: [
    { key: "email", label: "メール", on: false, locked: false },
    { key: "inApp", label: "サービス内通知", on: true, locked: true },
  ],
  sendChannels: ["inApp"],
  toggleChannel: () => {},
  target: { type: "all", roles: [], groupId: "" },
  setTarget: (patch: unknown) => events.push(`target:${JSON.stringify(patch)}`),
  allowedTargetTypes: [],
  roles: [{ id: "admin", label: "管理者" }],
  groups: [{ id: "g1", label: "会員", kindLabel: "手動" }],
  groupsEnabled: true,
  adminVars: [] as unknown[],
  vars: {},
  setVar: () => {},
  missingVars: [],
  canEdit: true,
  textControl: {},
  textFields: {},
  showSchedule: false,
  scheduleMode: "now",
  scheduledAt: "",
  scheduleError: null,
  scheduleNote: "注記",
  setScheduleMode: () => {},
  setScheduledAt: () => {},
  definitionError: null,
  contentError: null,
  targetError: null,
  canSend: true,
  preview: null,
  isPreviewing: false,
  isTesting: false,
  isSending: false,
  result: null as unknown,
  runPreview: async () => void events.push("preview"),
  closePreview: () => {},
  sendTest: async () => void events.push("test"),
  requestConfirm: async () => void events.push("confirm"),
  backToEdit: () => events.push("back"),
  confirmSend: async () => {
    events.push("send");
    return { status: "queued" };
  },
});
let state: ReturnType<typeof baseState> = baseState();
const RESULTS = { channels: { email: { targeted: 1 } }, failed: { items: [] } };
mock.module("@/domains/core/messaging/hooks", {
  namedExports: {
    useDefinitionSendModal: () => state,
    useSendResults: (dispatchId: string | null) => {
      events.push(`results:${dispatchId}`);
      return RESULTS;
    },
    dispatchDetailHref: (base: string, id: string) => `${base}?dispatch=${id}`,
  },
});

mock.module("@/components/Overlays/Modal", {
  defaultExport: ({ open, title, children, footer }: Record<string, unknown>) =>
    open ? createElement("section", { "data-testid": "modal" }, title as never, children as never, footer as never) : null,
});
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: { children?: unknown; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
  },
});
mock.module("@/components/Input/Select", {
  namedExports: { SelectInput: (props: Record<string, unknown>) => (lastProps.set("select", props), createElement("span")) },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });

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
const COMMON = "@/domains/core/messaging/components/common";
mock.module(`${COMMON}/SendCategoryChannels`, { namedExports: { SendCategoryChannels: stub("channels") } });
mock.module(`${COMMON}/SendTargetPicker`, { namedExports: { SendTargetPicker: stub("target") } });
mock.module(`${COMMON}/SendTemplatePicker`, { namedExports: { SendVarInputs: stub("vars") } });
mock.module(`${COMMON}/LayoutFields`, { namedExports: { LayoutFields: stub("layoutFields") } });
mock.module(`${COMMON}/SendSchedule`, { namedExports: { SendSchedule: stub("schedule") } });
mock.module(`${COMMON}/SendConfirmView`, { namedExports: { SendResultView: stub("resultView") } });
mock.module(`${COMMON}/SendResult`, { namedExports: { SendResult: stub("sendResult") } });
mock.module(`${COMMON}/SampleForYouModal`, { namedExports: { SampleForYouModal: stub("sampleForYou") } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let mod: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  mod = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  events.length = 0;
  state = baseState();
  lastProps.clear();
});

const render = async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(mod.DefinitionSendModal, { entry: state.entry as never })));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(text)) as HTMLButtonElement | undefined;
const part = (container: HTMLElement, name: string) => container.querySelector(`[data-part=${name}]`);

test("門が閉の broadcast は何も描かない", async () => {
  state = { ...baseState(), available: false };
  const view = await render();
  assert.equal(view.container.innerHTML, "");
  await view.unmount();
});

test("書く段(記録の入口・連絡定義 1 つ): 表示名・説明・送信方法・選んだ記録・直せる欄、ボタンで hook を呼ぶ", async () => {
  const view = await render();
  const text = view.container.textContent ?? "";
  assert.match(text, /振込の明細/);
  assert.match(text, /明細を送ります/);
  assert.equal(lastProps.has("select"), false, "1 つなら選ぶ欄は出さない");
  assert.deepEqual(lastProps.get("channels")!.channels, state.channels);
  assert.deepEqual(
    { kind: lastProps.get("target")!.kind, recordCount: lastProps.get("target")!.recordCount, recordNoun: lastProps.get("target")!.recordNoun },
    { kind: "bulk", recordCount: 2, recordNoun: "振込レビュー" },
  );
  assert.ok(part(view.container, "layoutFields"));
  assert.equal(part(view.container, "schedule"), null, "記録の入口は予約しない");
  assert.equal(part(view.container, "vars"), null, "管理者の値が無ければ出さない");
  await act(async () => button(view.container, "あなた宛ての表示例")!.click());
  await act(async () => button(view.container, "自分にテスト送信")!.click());
  await act(async () => button(view.container, "確認に進む")!.click());
  assert.deepEqual(events.filter((e) => !e.startsWith("results")), ["preview", "test", "confirm"]);
  await view.unmount();
});

test("連絡定義が 2 つ以上は選ぶ欄、required は文面の箱なし、broadcast は宛先を選び予約を出す", async () => {
  const other = { ...DEF, key: "b.other", label: "ほか" };
  state = {
    ...baseState(),
    entry: { type: "broadcast" } as never,
    definitions: [DEF, other],
    definition: { ...DEF, required: true },
    canEdit: false,
    allowedTargetTypes: ["all", "role"] as never,
    showSchedule: true,
    adminVars: [{ key: "amount", alias: "金額", type: "number", required: true }],
  };
  const view = await render();
  const select = lastProps.get("select")!;
  assert.deepEqual(select.options, [
    { value: DEF.key, label: DEF.label },
    { value: "b.other", label: "ほか" },
  ]);
  (select.onChange as (v: string) => void)("b.other");
  assert.ok(events.includes("choose:b.other"));
  assert.equal(part(view.container, "layoutFields"), null);
  assert.match(view.container.textContent ?? "", /この連絡の文面は変えられません/);
  assert.equal(lastProps.get("target")!.kind, "select");
  assert.deepEqual(lastProps.get("target")!.allowedTypes, ["all", "role"]);
  (lastProps.get("target")!.onChange as (patch: unknown) => void)({ type: "role", roles: ["admin"] });
  assert.ok(events.includes('target:{"type":"role","roles":["admin"]}'));
  assert.ok(part(view.container, "schedule"));
  assert.ok(part(view.container, "vars"));
  await view.unmount();
});

test("確認の段: 確認の文と宛先の文、送るで confirmSend", async () => {
  state = { ...baseState(), step: "confirm" };
  const view = await render();
  const text = view.container.textContent ?? "";
  assert.match(text, /連絡: 振込の明細/);
  assert.match(text, /選択した 2 件の振込レビューに関連するユーザー/);
  assert.match(text, /送信方法: サービス内通知/);
  assert.match(text, /送ると取り消せません/);
  await act(async () => button(view.container, "送信する")!.click());
  await act(async () => button(view.container, "戻る")!.click());
  assert.deepEqual(events.filter((e) => !e.startsWith("results")), ["send", "back"]);
  await view.unmount();
});

test("結果の段: SendResultView と送信の結果", async () => {
  state = {
    ...baseState(),
    step: "done",
    result: { dispatchId: "d1", status: "queued", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 0 }, afterSend: { ok: true } },
  };
  const view = await render();
  assert.ok(events.includes("results:d1"));
  const result = lastProps.get("resultView")!;
  assert.equal(result.dispatchHref, "/admin/messaging?dispatch=d1");
  assert.deepEqual(result.afterSend, { ok: true });
  assert.equal(result.recordNoun, "振込レビュー");
  assert.equal(lastProps.get("sendResult")!.channels, RESULTS.channels);
  assert.equal(lastProps.get("sendResult")!.failed, RESULTS.failed);
  await act(async () => button(view.container, "閉じる")!.click());
  assert.ok(events.includes("open:false"));
  await view.unmount();
});

test("definitionRecipientsText", () => {
  const base = { entry: { type: "broadcast" }, recordCount: 0, recordNoun: "", roles: [{ id: "admin", label: "管理者" }], groups: [{ id: "g1", label: "会員", kindLabel: "手動" }] };
  assert.equal(mod.definitionRecipientsText({ ...base, target: { type: "all", roles: [], groupId: "" } } as never), "全員");
  assert.equal(mod.definitionRecipientsText({ ...base, target: { type: "role", roles: ["admin"], groupId: "" } } as never), "ロール: 管理者");
  assert.equal(mod.definitionRecipientsText({ ...base, target: { type: "group", roles: [], groupId: "g1" } } as never), "グループ: 会員");
});
