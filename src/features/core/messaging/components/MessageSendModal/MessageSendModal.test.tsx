// 送るモーダルの入れ物と、開く口の検査(jsdom の上で描く。hook・Modal・部品の一部は偽物)。
// - 入れ物: ボタンで開く / 書く段は部品を並べる(テンプレートは呼び出せる時だけ、予約は bulk で出さない)/
//   confirmOnClose に hook の closeConfirm を渡す / 確認の段は「送る」で confirmSend、「戻る」で backToEdit / 結果の段
// - 開く口: 回の一覧の「新しく送る」は門 messagingBroadcast が開の時だけ
// 実行: pnpm test src/features/core/messaging/components/MessageSendModal/MessageSendModal.test.tsx
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
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const events: string[] = [];
let modalConfirm: unknown = null;
let state: Record<string, unknown> = {};
const baseState = () => ({
  open: true,
  setOpen: (v: boolean) => events.push(`open:${v}`),
  step: "edit",
  optionsLoaded: true,
  optionsError: null,
  closeConfirm: { enabled: true, message: "書きかけ" },
  templatesAvailable: true,
  templates: [{ id: "t1", name: "春", currentVersion: 2 }],
  calledTemplate: null,
  draft: { source: "adhoc", template: null, content: {}, vars: {} },
  audience: { type: "all", roles: [], audienceKey: "", userIds: [] },
  roles: [],
  audiences: [],
  allowedCategories: [{ key: "notice", label: "お知らせ" }],
  category: "notice",
  channels: [{ key: "email", label: "メール", on: true, blank: false }],
  showSchedule: true,
  scheduleMode: "now",
  scheduledAt: "",
  scheduleError: null,
  scheduleNote: "注記",
  contentError: null,
  audienceError: null,
  canSend: true,
  preview: null,
  estimate: { count: 5, capped: false },
  result: null,
  isPreviewing: false,
  isTesting: false,
  isSending: false,
  callTemplate: () => {},
  clearTemplate: () => {},
  setChannelFields: () => {},
  setVar: () => {},
  setAudience: () => {},
  setCategory: () => {},
  toggleChannel: () => {},
  setScheduleMode: () => {},
  setScheduledAt: () => {},
  runPreview: async () => events.push("preview"),
  sendTest: async () => events.push("test"),
  requestConfirm: async () => events.push("confirm"),
  backToEdit: () => events.push("back"),
  confirmSend: async () => {
    events.push("send");
    return { kind: "send", result: { status: "queued" } };
  },
});
mock.module("@/features/core/messaging/hooks/useMessageSendModal", {
  namedExports: { useMessageSendModal: () => state },
});
mock.module("@/components/Overlays/Modal", {
  defaultExport: ({ open, title, children, footer, confirmOnClose }: Record<string, unknown>) => {
    modalConfirm = confirmOnClose;
    return open ? createElement("section", { "data-testid": "modal" }, title as never, children as never, footer as never) : null;
  },
});
mock.module("@/components/Form/Button", {
  namedExports: {
    Button: (props: { children?: unknown; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
    LinkButton: (props: { href: string; children?: unknown }) => createElement("a", { href: props.href }, props.children as never),
  },
});
const stub = (name: string) => {
  const Stub = (props: Record<string, unknown>) => createElement("div", { "data-part": name, "data-kind": String(props.kind ?? "") });
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
mock.module("@/features/core/messaging/components/common/SendTemplatePicker", { namedExports: { SendTemplatePicker: stub("template") } });
mock.module("@/features/core/messaging/components/common/SendAudiencePicker", { namedExports: { SendAudiencePicker: stub("audience") } });
mock.module("@/features/core/messaging/components/common/SendCategoryChannels", { namedExports: { SendCategoryChannels: stub("category") } });
mock.module("@/features/core/messaging/components/common/SendContentFields", { namedExports: { SendContentFields: stub("content") } });
mock.module("@/features/core/messaging/components/common/SendSchedule", { namedExports: { SendSchedule: stub("schedule") } });
mock.module("@/features/core/messaging/components/common/SendConfirmView", {
  namedExports: { SendConfirmView: stub("confirm"), SendResultView: stub("result") },
});
mock.module("@/features/core/messaging/components/common/MessagePreview", { namedExports: { MessagePreview: stub("preview") } });
// 回の一覧の絞り込みの入力は jsdom で動かさない偽物
mock.module("@/components/Form/Input/Manual", {
  namedExports: {
    DateInput: () => createElement("input"),
    Input: () => createElement("input"),
    SelectInput: () => createElement("span"),
  },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });
let broadcastOpen = true;
mock.module("@/featureGate/client", { namedExports: { useGate: () => ({ enabled: () => broadcastOpen }) } });
mock.module("@/features/core/messaging/hooks/useAdminDispatches", {
  namedExports: {
    useAdminDispatches: () => ({ items: [], isInitialLoading: false, isFetchingMore: false, hasMore: false, error: null, sentinelRef: () => {}, retry: () => {} }),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let MessageSendModal: typeof import("./index").MessageSendModal;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ MessageSendModal } = await import("./index"));
});
after(() => dom.window.close());
beforeEach(() => {
  events.length = 0;
  state = baseState();
  broadcastOpen = true;
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
/** 文言がちょうど一致するボタン(「送る」と「新しく送る」を分ける) */
const exact = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === text) as HTMLButtonElement | undefined;
const parts = (container: HTMLElement) => [...container.querySelectorAll("[data-part]")].map((el) => el.getAttribute("data-part"));

test("書く段: 部品を並べ、confirmOnClose に closeConfirm、ボタンで hook を呼ぶ", async () => {
  const view = await render(createElement(MessageSendModal, { mode: { type: "new" } }));
  assert.deepEqual(parts(view.container), ["template", "audience", "category", "content", "schedule"]);
  assert.deepEqual(modalConfirm, { enabled: true, message: "書きかけ" });
  await act(async () => button(view.container, "新しく送る")!.click());
  await act(async () => button(view.container, "プレビュー")!.click());
  await act(async () => button(view.container, "自分にテスト送信")!.click());
  await act(async () => button(view.container, "確認へ")!.click());
  assert.deepEqual(events, ["open:true", "preview", "test", "confirm"]);
  await view.unmount();
});

test("テンプレートを呼び出せない時・bulk は予約を出さない", async () => {
  state = { ...baseState(), templatesAvailable: false, showSchedule: false };
  const view = await render(
    createElement(MessageSendModal, { mode: { type: "bulk", target: "t", recordIds: ["r"], recordNoun: "記録" } }),
  );
  assert.deepEqual(parts(view.container), ["audience", "category", "content"]);
  assert.equal(view.container.querySelector("[data-part=audience]")?.getAttribute("data-kind"), "bulk");
  await view.unmount();
});

test("確認の段: 送る → confirmSend、戻る → backToEdit / 結果の段", async () => {
  state = { ...baseState(), step: "confirm" };
  const view = await render(createElement(MessageSendModal, { mode: { type: "new" } }));
  assert.deepEqual(parts(view.container), ["confirm"]);
  await act(async () => button(view.container, "戻る")!.click());
  await act(async () => exact(view.container, "送る")!.click());
  assert.deepEqual(events, ["back", "send"]);
  await view.unmount();

  state = { ...baseState(), step: "done", result: { kind: "send", result: { status: "queued", queuedCount: 0, dispatchId: "d1" } } };
  const done = await render(createElement(MessageSendModal, { mode: { type: "new" } }));
  assert.deepEqual(parts(done.container), ["result"]);
  await done.unmount();
});

test("開く口: 回の一覧の「新しく送る」は門 messagingBroadcast が開の時だけ", async () => {
  const { AdminDispatchList } = await import("../AdminDispatchList");
  state = { ...baseState(), open: false };
  const open = await render(createElement(AdminDispatchList));
  assert.ok(button(open.container, "新しく送る"));
  await open.unmount();
  broadcastOpen = false;
  const closed = await render(createElement(AdminDispatchList));
  assert.equal(button(closed.container, "新しく送る"), undefined);
  await closed.unmount();
});
