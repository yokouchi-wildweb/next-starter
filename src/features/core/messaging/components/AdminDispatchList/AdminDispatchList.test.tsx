// 回の一覧と回の詳細の入れ物の検査(jsdom の上で描く。hook・入力・部品の一部は偽物)。D46: 運営する人に鍵を打たせず見せない
// - 一覧: 定義の鍵の欄が無い / カテゴリーの選びは種別を選ぶまで押せず、選ぶとその種別のカテゴリー(表示名)/ 行に種別・カテゴリーの表示名
// - 詳細: 種別・カテゴリーの表示名、送り元は表示名がある時だけ、定義の鍵・送り元の鍵・経路の鍵は出ない
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
  channelCounts: { email: { targeted: 1, sent: 1, failed: 0, suppressed: 0, skipped_no_address: 0, skipped_throttled: 0 } },
  actor: { id: "a1", type: "admin" },
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
    useAdminDispatches: () => ({ items: [DISPATCH], isInitialLoading: false, isFetchingMore: false, hasMore: false, error: null, sentinelRef: () => {}, retry: () => {} }),
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
mock.module("@/features/core/messaging/hooks/useAdminDispatchDetail", {
  namedExports: {
    useAdminDispatchDetail: () => ({
      dispatch: detail,
      error: null,
      isLoading: false,
      deliveries: { items: [], isInitialLoading: false, isFetchingMore: false, hasMore: false, error: null, sentinelRef: () => {}, retry: () => {} },
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
});

const render = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const KEY_LIKE = /messaging\.admin|campaign|operatorDirect|\binApp\b|\bemail\b|\bmarketing\b/;

test("一覧: 定義の鍵の欄は無く、カテゴリーは種別を選ぶまで押せない。行は表示名で鍵を出さない", async () => {
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

test("詳細: 種別・カテゴリーの表示名、送り元は表示名がある時だけ、鍵は出さない", async () => {
  const view = await render(createElement(AdminDispatchDetail, { dispatchId: "d1" }));
  const text = view.container.textContent ?? "";
  assert.match(text, /キャンペーン情報/);
  assert.match(text, /キャンペーン/);
  assert.doesNotMatch(text, /送り元/, "表示名が無ければ行ごと出さない");
  assert.doesNotMatch(text, /定義の鍵/);
  assert.doesNotMatch(text, KEY_LIKE);
  await view.unmount();

  detail = { ...DISPATCH, sourceLabel: "管理者の一括送信", category: "gone" };
  const labeled = await render(createElement(AdminDispatchDetail, { dispatchId: "d1" }));
  assert.match(labeled.container.textContent ?? "", /送り元管理者の一括送信/);
  assert.match(labeled.container.textContent ?? "", /今は無いカテゴリー/);
  await labeled.unmount();
});
