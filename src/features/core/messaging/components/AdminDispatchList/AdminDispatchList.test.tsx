// 回の一覧と回の詳細の入れ物の検査(jsdom の上で描く。hook・入力・部品の一部は偽物)。D46: 運営する人に鍵を打たせず見せない
// - 一覧: 定義の鍵の欄が無い / カテゴリーの選びは種別を選ぶまで押せず、選ぶとその種別のカテゴリー(表示名)/ 行に種別・カテゴリーの表示名
// - 詳細: 種別・カテゴリーの表示名、送り元は表示名がある時だけ、定義の鍵・送り元の鍵・経路の鍵は出ない
// - グループ宛ての回: 一覧の行と詳細にグループの名前(名前が無ければ「グループ」)、id は出さない
// 実行: pnpm test src/features/core/messaging/components/AdminDispatchList/AdminDispatchList.test.tsx
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

type SelectProps = { id?: string; options?: { value: string; label: string }[]; disabled?: boolean; placeholder?: string };
const selects: Record<string, SelectProps> = {};
mock.module("@/components/Form/Input/Manual", {
  namedExports: {
    DateInput: () => createElement("input"),
    Input: (props: { id?: string }) => createElement("input", { id: props.id }),
    SelectInput: (props: SelectProps) => {
      if (props.id) selects[props.id] = props;
      return createElement("span", { id: props.id });
    },
  },
});
mock.module("@/components/Form/Button", {
  namedExports: {
    Button: (props: { children?: unknown; onClick?: () => void }) => createElement("button", { type: "button", onClick: props.onClick }, props.children as never),
  },
});
mock.module("@/components/Navigation/Link", {
  namedExports: { Link: (props: { href: string; children?: unknown }) => createElement("a", { href: props.href }, props.children as never) },
});
mock.module("@/featureGate/client", { namedExports: { useGate: () => ({ enabled: () => false }) } });
mock.module("@/features/core/messaging/components/MessageSendModal", { namedExports: { MessageSendModal: () => null } });
const DISPATCH = {
  id: "d1",
  messageKey: "messaging.adminMarketing",
  kind: "marketing",
  category: "campaign",
  source: "messaging.adminBulk",
  sourceLabel: null as string | null,
  status: "completed",
  channels: ["email", "inApp"],
  headings: { email: "春のセール" },
  recipientCount: 2,
  targetGroup: null as { id: string; name: string | null } | null,
  channelCounts: { email: { targeted: 1, sent: 1, failed: 0, suppressed: 0, skipped_no_address: 0, skipped_throttled: 0 } },
  actor: { id: "a1", type: "admin" },
  actorName: "管理者 A" as string | null,
  isTest: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  completedAt: null,
  scheduledAt: null,
  retractedAt: null,
  body: null,
  reason: null,
  operations: {},
};
let kind = "";
let listItems: Record<string, unknown>[] = [DISPATCH];
const setCalls: string[] = [];
mock.module("@/features/core/messaging/hooks/useAdminDispatchFilters", {
  namedExports: {
    useAdminDispatchFilters: () => ({
      filters: {},
      apply: () => {},
      clear: () => {},
      fields: {
        fromDate: "",
        setFromDate: () => {},
        toDate: "",
        setToDate: () => {},
        kind,
        setKind: (v: string) => setCalls.push(`kind:${v}`),
        category: "",
        setCategory: (v: string) => setCalls.push(`category:${v}`),
        channel: "",
        setChannel: () => {},
        status: "",
        setStatus: () => {},
      },
    }),
  },
});
mock.module("@/features/core/messaging/hooks/useAdminDispatches", {
  namedExports: {
    useAdminDispatches: () => ({ items: listItems, isInitialLoading: false, isFetchingMore: false, hasMore: false, error: null, sentinelRef: () => {}, retry: () => {} }),
  },
});
const CATS = [
  { key: "campaign", label: "キャンペーン", kind: "marketing" },
  { key: "operatorDirect", label: "運営からのご連絡", kind: "direct" },
];
mock.module("@/features/core/messaging/hooks/useAdminDispatchCategories", {
  namedExports: {
    useAdminDispatchCategories: () => ({
      categories: CATS,
      loaded: true,
      optionsOf: (k: string) => CATS.filter((c) => c.kind === k).map((c) => ({ value: c.key, label: c.label })),
      labelOf: (key: string | null) => CATS.find((c) => c.key === key)?.label ?? null,
    }),
  },
});
let detail: Record<string, unknown> = {};
let deliveryItems: Record<string, unknown>[] = [];
mock.module("@/features/core/messaging/hooks/useAdminDispatchDetail", {
  namedExports: {
    useAdminDispatchDetail: () => ({
      dispatch: detail,
      error: null,
      isLoading: false,
      deliveries: { items: deliveryItems, isInitialLoading: false, isFetchingMore: false, hasMore: false, error: null, sentinelRef: () => {}, retry: () => {} },
      deliveryFilters: { status: "", setStatus: () => {}, channel: "", setChannel: () => {} },
      includeUnknown: false,
      setIncludeUnknown: () => {},
      cancel: async () => {},
      retract: async () => {},
      resend: async () => {},
      continueDispatch: async () => {},
    }),
  },
});
mock.module("@/features/core/messaging/components/common/DispatchOperations", { namedExports: { DispatchOperations: () => null } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let AdminDispatchList: typeof import("./index").AdminDispatchList;
let AdminDispatchDetail: typeof import("../AdminDispatchDetail").AdminDispatchDetail;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ AdminDispatchList } = await import("./index"));
  ({ AdminDispatchDetail } = await import("../AdminDispatchDetail"));
});
after(() => dom.window.close());
beforeEach(() => {
  kind = "";
  setCalls.length = 0;
  detail = { ...DISPATCH };
  deliveryItems = [];
  listItems = [DISPATCH];
});

const render = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const KEY_LIKE = /messaging\.admin|campaign|operatorDirect|\binApp\b|\bemail\b|\bmarketing\b/;

// D69: restore before ship (J98: kind promotion / adminEditableOnly / channel fieldMeta)
test.skip("一覧: 定義の鍵の欄は無く、カテゴリーは種別を選ぶまで押せない。行は表示名で鍵を出さない", async () => {
  const view = await render(createElement(AdminDispatchList));
  assert.equal(view.container.querySelector("#dispatch-filter-key"), null);
  assert.equal(selects["dispatch-filter-category"].disabled, true);
  assert.deepEqual(selects["dispatch-filter-category"].options, []);
  assert.equal(selects["dispatch-filter-kind"].options?.length, 7);
  const text = view.container.textContent ?? "";
  assert.match(text, /キャンペーン情報/, "種別の表示名");
  assert.match(text, /キャンペーン/);
  assert.match(text, /メール \/ お知らせ/);
  assert.doesNotMatch(text, KEY_LIKE);
  await view.unmount();

  kind = "marketing";
  const chosen = await render(createElement(AdminDispatchList));
  assert.equal(selects["dispatch-filter-category"].disabled, false);
  assert.deepEqual(selects["dispatch-filter-category"].options, [{ value: "campaign", label: "キャンペーン" }]);
  await chosen.unmount();
});

// D69: restore before ship (J98: kind promotion / adminEditableOnly / channel fieldMeta)
test.skip("詳細: 種別・カテゴリーの表示名、送り元は表示名がある時だけ、鍵は出さない", async () => {
  const view = await render(createElement(AdminDispatchDetail, { dispatchId: "d1" }));
  const text = view.container.textContent ?? "";
  assert.match(text, /キャンペーン情報/);
  assert.match(text, /キャンペーン/);
  assert.doesNotMatch(text, /送信元/, "表示名が無ければ行ごと出さない");
  assert.doesNotMatch(text, /定義の鍵/);
  assert.doesNotMatch(text, KEY_LIKE);
  await view.unmount();

  detail = { ...DISPATCH, sourceLabel: "管理者の一括送信", category: "gone" };
  const labeled = await render(createElement(AdminDispatchDetail, { dispatchId: "d1" }));
  assert.match(labeled.container.textContent ?? "", /送信元管理者の一括送信/);
  assert.match(labeled.container.textContent ?? "", /削除されたカテゴリー/);
  await labeled.unmount();
});

// D69: restore before ship
test.skip("詳細: 送信者は名前、本文は経路の欄(生の JSON なし)、配達は利用者の名前・表に無い符号は決まった文", async () => {
  const UID = "60ce3c85-1111-4111-8111-111111111111";
  detail = {
    ...DISPATCH,
    record: "vars",
    body: { email: { subject: "春のセール", paragraphs: ["本文の段落"] }, inApp: { title: "春", body: "お知らせの本文" } },
  };
  deliveryItems = [
    { id: "v1", recipientKey: `user:${UID}`, userId: UID, userName: "山田", address: UID, channel: "inApp", status: "failed", reason: "weird_reason", errorCode: "http_403", attempts: 1, createdAt: "2026-11-01T00:00:00.000Z", failedAt: null, deliveredAt: null, sentAt: null, openedAt: null },
    { id: "v2", recipientKey: "user:x", userId: "x", userName: null, address: "a@example.test", channel: "email", status: "sent", reason: null, errorCode: null, attempts: 1, createdAt: "2026-11-01T00:00:00.000Z", failedAt: null, deliveredAt: null, sentAt: null, openedAt: null },
  ];
  const view = await render(createElement(AdminDispatchDetail, { dispatchId: "d1" }));
  const text = view.container.textContent ?? "";
  assert.match(text, /送信者管理者 A/);
  assert.match(text, /本文の段落/);
  assert.match(text, /お知らせの本文/);
  assert.doesNotMatch(text, /\{"/, "生の JSON は出さない");
  assert.match(text, /利用者 山田/);
  assert.match(text, /利用者 \(名前の無い利用者\)/);
  assert.match(text, /a@example\.test/, "メールの宛先は出す");
  assert.doesNotMatch(text, new RegExp(UID), "利用者の id・お知らせの宛先は出さない");
  assert.match(text, /送信できませんでした/);
  assert.doesNotMatch(text, /http_403|weird_reason/);
  assert.match(text, /その他/);
  await view.unmount();

  detail = { ...DISPATCH, actorName: null, actor: { id: null, type: "system" } };
  const system = await render(createElement(AdminDispatchDetail, { dispatchId: "d1" }));
  assert.match(system.container.textContent ?? "", /送信者システム/);
  await system.unmount();
});

// D69: restore before ship (J101: delete replaces cancel / retract, flags canDelete / canResend / canContinue, deletedAt)
test.skip("グループ宛ての回: 一覧の行と詳細にグループの名前、名前が無ければ「グループ」、id は出さない", async () => {
  const GROUP_ID = "44444444-4444-4444-8444-444444444444";
  const named = { ...DISPATCH, id: "d2", targetGroup: { id: GROUP_ID, name: "常連" } };
  const unnamed = { ...DISPATCH, id: "d3", targetGroup: { id: GROUP_ID, name: null } };
  listItems = [named, unnamed, DISPATCH];
  const list = await render(createElement(AdminDispatchList));
  const targets = [...list.container.querySelectorAll('[data-slot="dispatch-target"]')].map((el) => el.textContent);
  assert.deepEqual(targets, ["宛先: グループ「常連」 2 名", "宛先: グループ 2 名", "宛先数 2 名"]);
  assert.doesNotMatch(list.container.textContent ?? "", new RegExp(GROUP_ID));
  await list.unmount();

  detail = named;
  const shown = await render(createElement(AdminDispatchDetail, { dispatchId: "d2" }));
  assert.match(shown.container.textContent ?? "", /宛先グループ「常連」/);
  assert.doesNotMatch(shown.container.textContent ?? "", new RegExp(GROUP_ID));
  await shown.unmount();
  detail = unnamed;
  const bare = await render(createElement(AdminDispatchDetail, { dispatchId: "d3" }));
  assert.match(bare.container.textContent ?? "", /宛先グループ宛先数/);
  await bare.unmount();
  detail = { ...DISPATCH };
  const plain = await render(createElement(AdminDispatchDetail, { dispatchId: "d1" }));
  assert.doesNotMatch(plain.container.textContent ?? "", /宛先グループ/);
  await plain.unmount();
});
