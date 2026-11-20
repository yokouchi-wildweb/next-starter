// 回の一覧(AdminDispatchList)と、一覧の上に開く回の詳細のモーダル(AdminDispatchDetailModal、D130)の検査。
// jsdom の上で描く。hook・入力・モーダル・next/navigation・送るモーダル・回の操作は偽物(next/navigation の検索の値は差し替えられる)。
// D46: 運営する人に鍵を打たせず見せない
// - 一覧: 定義の鍵の欄が無い / カテゴリーの選びは種別を選ぶまで押せず、選ぶとその種別のカテゴリー(表示名)/ 行に種別・カテゴリー・送信方法の表示名
// - 一覧の行は ?dispatch=<id> の住所(ほかの検索の値は残す)。?dispatch があれば一覧の上にモーダルが開き、閉じると ?dispatch を外す
//   (URL を直に開いた時 = 置き換え、行から開いた時 = 「戻る」)
// - 詳細(基本情報のタブ): 種別・カテゴリーの表示名、送り元は表示名がある時だけ、送った人は名前、テンプレートの行
//   (v<n>・消したテンプレートは「削除されたテンプレート(v<n>)」・システムテンプレート)、定義の鍵・送り元の鍵・経路の鍵は出ない
// - 詳細(送信状況のタブ): 配達は利用者の名前、利用者の id・お知らせの宛先は出さず、表に無い符号は決まった文
// - 詳細(プレビューのタブ): 前の形の回の本文を経路ごとに(生の JSON は出さない)
// - グループ宛ての回: 一覧の行と詳細にグループの名前(名前が無ければ「グループ」)、id は出さない
// 実行: pnpm test src/features/core/messaging/components/AdminDispatchList/AdminDispatchList.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { JSDOM } from "jsdom";

import type { AdminDeliveryRow, AdminDispatchDetail } from "@/features/core/messaging/services/client/adminMessagingClient";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// 行は <a href> の偽物。jsdom の移動(未実装)をさせない
dom.window.document.addEventListener("click", (event) => event.preventDefault());

// next/navigation: 住所と検索の値は検査が差し替える(useDispatchDetailParam が読む)
const nav = { pathname: "/admin/messaging", search: "" };
mock.module("next/navigation", {
  namedExports: {
    usePathname: () => nav.pathname,
    useSearchParams: () => new URLSearchParams(nav.search),
    useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {}, refresh: () => {}, prefetch: () => {} }),
    useParams: () => ({}),
    useSelectedLayoutSegments: () => [],
    redirect: () => {},
    notFound: () => {},
  },
});
// @/lib/unsavedGuard の router(モーダルを閉じる時の戻る・置き換えを記録する)
const routerCalls: string[] = [];
const noop = () => {};
mock.module("@/lib/unsavedGuard", {
  namedExports: {
    useRouter: () => ({
      push: (href: string) => void routerCalls.push(`push:${href}`),
      replace: (href: string) => void routerCalls.push(`replace:${href}`),
      back: () => void routerCalls.push("back"),
      refresh: noop,
      prefetch: noop,
      forward: noop,
    }),
    UnsavedGuardProvider: ({ children }: { children?: ReactNode }) => children ?? null,
    useLinkNavigateJudge: () => null,
    useUnsavedGuard: () => ({ setSource: noop, clearSource: noop }),
    useUnsavedSource: noop,
    useUnsavedSourceFactory: () => noop,
    useUnsavedTasks: () => ({ track: noop }),
    NAVIGATION_PORT_ATTR: "data-navigation-port",
    UNSAVED_REASONS: [],
    pickConfirmReason: () => null,
  },
});

type SelectProps = { id?: string; options?: { value: string; label: string }[]; disabled?: boolean; placeholder?: string };
const selects: Record<string, SelectProps> = {};
mock.module("@/components/Input/DateInput", {
  namedExports: {
    DateInput: () => createElement("input"),
  },
});
mock.module("@/components/Input/DatetimeInput", {
  namedExports: {
    DatetimeInput: () => createElement("input"),
  },
});
mock.module("@/components/Input/SwitchInput", {
  namedExports: {
    // 一覧の選択(lib/tableSuite の BulkActionBar、J109)の「選択モード」の切り替え
    SwitchInput: (props: { label?: string }) => createElement("input", { type: "checkbox", "aria-label": props.label }),
  },
});
mock.module("@/components/Input/Input", {
  namedExports: {
    Input: (props: { id?: string }) => createElement("input", { id: props.id }),
  },
});
mock.module("@/components/Input/Select", {
  namedExports: {
    SelectInput: (props: SelectProps) => {
      if (props.id) selects[props.id] = props;
      return createElement("span", { id: props.id });
    },
  },
});
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: { children?: ReactNode; onClick?: () => void }) => createElement("button", { type: "button", onClick: props.onClick }, props.children),
  },
});
mock.module("@/components/Button/LinkButton", {
  namedExports: {
    LinkButton: (props: { href: string; children?: ReactNode }) => createElement("a", { href: props.href }, props.children),
  },
});
mock.module("@/components/Navigation/Link", {
  namedExports: {
    Link: (props: { href: string; children?: ReactNode; "data-slot"?: string }) =>
      createElement("a", { href: props.href, "data-slot": props["data-slot"] }, props.children),
  },
});
// Modal / TabbedModal は Radix(portal・focus)を jsdom で動かさない偽物: 題・タブの見出し(押すと onValueChange)・選んだタブの中身・下の帯・閉じるボタン
mock.module("@/components/Overlays/Modal", {
  defaultExport: (props: { open: boolean; title?: ReactNode; children?: ReactNode; onOpenChange: (open: boolean) => void }) =>
    props.open
      ? createElement(
          "section",
          { "data-testid": "modal" },
          createElement("h2", null, props.title),
          props.children,
          createElement("button", { type: "button", "data-testid": "modal-close", onClick: () => props.onOpenChange(false) }, "閉じる"),
        )
      : null,
});
type FakeTab = { value: string; label: ReactNode; content: ReactNode };
mock.module("@/components/Overlays/TabbedModal", {
  defaultExport: (props: {
    open: boolean;
    title?: ReactNode;
    tabs: FakeTab[];
    value?: string;
    onValueChange?: (value: string) => void;
    footer?: ReactNode;
    onOpenChange: (open: boolean) => void;
  }) =>
    props.open
      ? createElement(
          "section",
          { "data-testid": "modal" },
          createElement("h2", null, props.title),
          createElement(
            "nav",
            null,
            props.tabs.map((tab) =>
              createElement("button", { key: tab.value, type: "button", "data-tab": tab.value, onClick: () => props.onValueChange?.(tab.value) }, tab.label),
            ),
          ),
          createElement("div", { "data-testid": "tab-content" }, props.tabs.find((tab) => tab.value === props.value)?.content ?? null),
          props.footer,
          createElement("button", { type: "button", "data-testid": "modal-close", onClick: () => props.onOpenChange(false) }, "閉じる"),
        )
      : null,
});
mock.module("@/featureGate/client", { namedExports: { useGate: () => ({ enabled: () => false }) } });
mock.module("@/features/core/messaging/components/MessageSendModal", { namedExports: { MessageSendModal: () => null } });
mock.module("@/features/core/messaging/components/common/DispatchOperations", { namedExports: { DispatchOperations: () => null } });

const DISPATCH: AdminDispatchDetail = {
  id: "d1",
  messageKey: "messaging.adminMarketing",
  kind: "promotion",
  category: "campaign",
  source: "messaging.adminBulk",
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
  deletedAt: null,
  targetGroup: null,
  record: null,
  target: null,
  tags: [],
  reason: null,
  metadata: null,
  templateId: null,
  templateVersion: null,
  templateDeleted: false,
  templateEdited: false,
  systemTemplate: null,
  content: null,
  targetUserIds: null,
  sourceLabel: null,
  actorName: "管理者 A",
  body: null,
  vars: null,
  embeddedValues: null,
  operations: {
    canDelete: { allowed: true, reason: null },
    canResend: { allowed: false, reason: "no_failed", mode: null, failed: 0, unknown: 0 },
    canContinue: { allowed: false, reason: "not_processing" },
  },
};
const delivery = (over: Partial<AdminDeliveryRow> & Pick<AdminDeliveryRow, "id">): AdminDeliveryRow => ({
  recipientKey: "user:x",
  userId: null,
  userName: null,
  address: null,
  channel: "email",
  status: "sent",
  reason: null,
  errorCode: null,
  attempts: 1,
  provider: null,
  targets: null,
  nextAttemptAt: null,
  sentAt: null,
  deliveredAt: null,
  failedAt: null,
  openedAt: null,
  clickedAt: null,
  complainedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  vars: null,
  body: null,
  ...over,
});

let kind = "";
let listItems: AdminDispatchDetail[] = [DISPATCH];
mock.module("@/features/core/messaging/hooks/useAdminDispatchFilters", {
  namedExports: {
    useAdminDispatchFilters: () => ({
      filters: {},
      apply: noop,
      clear: noop,
      fields: {
        fromDate: "",
        setFromDate: noop,
        toDate: "",
        setToDate: noop,
        kind,
        setKind: noop,
        category: "",
        setCategory: noop,
        channel: "",
        setChannel: noop,
        status: "",
        setStatus: noop,
      },
    }),
  },
});
mock.module("@/features/core/messaging/hooks/useAdminDispatches", {
  namedExports: {
    useAdminDispatches: () => ({
      items: listItems,
      isInitialLoading: false,
      isFetchingMore: false,
      hasMore: false,
      error: null,
      sentinelRef: noop,
      retry: noop,
      revalidate: noop,
    }),
  },
});
const CATS = [
  { key: "campaign", label: "キャンペーン", kind: "promotion" },
  { key: "operatorDirect", label: "運営からのご連絡", kind: "direct" },
];
mock.module("@/features/core/messaging/hooks/useAdminDispatchCategories", {
  namedExports: {
    useAdminDispatchCategories: () => ({
      categories: CATS,
      loaded: true,
      error: null,
      isLoading: false,
      optionsOf: (k: string) => CATS.filter((c) => c.kind === k).map((c) => ({ value: c.key, label: c.label })),
      labelOf: (key: string | null) => CATS.find((c) => c.key === key)?.label ?? null,
    }),
  },
});
let detail: AdminDispatchDetail = { ...DISPATCH };
let deliveryItems: AdminDeliveryRow[] = [];
mock.module("@/features/core/messaging/hooks/useAdminDispatchDetail", {
  namedExports: {
    useAdminDispatchDetail: () => ({
      dispatch: detail,
      error: null,
      isLoading: false,
      // 回の中身の無い回(前の形)= プレビューは残した本文
      preview: null,
      deliveries: {
        items: deliveryItems,
        isInitialLoading: false,
        isFetchingMore: false,
        hasMore: false,
        error: null,
        sentinelRef: noop,
        retry: noop,
        revalidate: noop,
      },
      deliveryFilters: { status: "", setStatus: noop, channel: "", setChannel: noop },
      includeUnknown: false,
      setIncludeUnknown: noop,
      remove: async () => {},
      deleteSummary: null,
      deleteSummaryLoading: false,
      deleteSummaryError: null,
      setDeleteConfirmOpen: noop,
      resend: async () => {},
      continueDispatch: async () => {},
    }),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let AdminDispatchList: typeof import("./index").AdminDispatchList;
let AdminDispatchDetailModal: typeof import("../AdminDispatchDetailModal").AdminDispatchDetailModal;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ AdminDispatchList } = await import("./index"));
  ({ AdminDispatchDetailModal } = await import("../AdminDispatchDetailModal"));
});
after(() => dom.window.close());
beforeEach(() => {
  kind = "";
  nav.search = "";
  routerCalls.length = 0;
  detail = { ...DISPATCH };
  deliveryItems = [];
  listItems = [DISPATCH];
});

const render = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    text: () => container.textContent ?? "",
    click: (el: Element | null | undefined) =>
      act(async () => {
        assert.ok(el, "押す物がある");
        el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      }),
    unmount: () => act(async () => root.unmount()),
  };
};
/** 回の詳細のモーダルを開く(既定のタブ = 基本情報) */
const renderDetail = (dispatchId = "d1") => render(createElement(AdminDispatchDetailModal, { dispatchId, onClose: noop }));
/** モーダルのタブを押して、その中身の文 */
const openTab = async (view: Awaited<ReturnType<typeof render>>, tab: "summary" | "deliveries" | "preview") => {
  await view.click(view.container.querySelector(`[data-tab="${tab}"]`));
  return view.container.querySelector('[data-testid="tab-content"]')?.textContent ?? "";
};
const KEY_LIKE = /messaging\.admin|campaign|operatorDirect|\binApp\b|\bemail\b|\bpromotion\b/;

test("一覧: 定義の鍵の欄は無く、カテゴリーは種別を選ぶまで押せない。行は表示名で鍵を出さない", async () => {
  const view = await render(createElement(AdminDispatchList));
  assert.equal(view.container.querySelector("#dispatch-filter-key"), null);
  assert.equal(selects["dispatch-filter-category"].disabled, true);
  assert.deepEqual(selects["dispatch-filter-category"].options, []);
  assert.equal(selects["dispatch-filter-kind"].options?.length, 7);
  const text = view.text();
  assert.match(text, /プロモーション/, "種別の表示名");
  assert.match(text, /キャンペーン/);
  // 送信方法は経路ごとの札(表示名)
  const channels = [...view.container.querySelectorAll('[data-slot="row-meta"][aria-label="送信方法"] [data-slot="soft-badge"]')].map((el) => el.textContent);
  assert.deepEqual(channels, ["メール", "お知らせ"]);
  assert.doesNotMatch(text, KEY_LIKE);
  await view.unmount();

  kind = "promotion";
  const chosen = await render(createElement(AdminDispatchList));
  assert.equal(selects["dispatch-filter-category"].disabled, false);
  assert.deepEqual(selects["dispatch-filter-category"].options, [{ value: "campaign", label: "キャンペーン" }]);
  await chosen.unmount();
});

test("一覧: 行は ?dispatch の住所。?dispatch があれば一覧の上に詳細のモーダルが開き、閉じると ?dispatch を外す", async () => {
  const closed = await render(createElement(AdminDispatchList));
  const row = () => closed.container.querySelector('a[data-slot="dispatch-row"]');
  assert.equal(row()?.getAttribute("href"), "/admin/messaging?dispatch=d1");
  assert.equal(closed.container.querySelector('[data-testid="modal"]'), null, "?dispatch が無ければ開かない");
  await closed.unmount();

  // URL を直に開いた: ほかの検索の値は残し、閉じると ?dispatch を外して置き換える
  nav.search = "foo=1&dispatch=d1";
  const direct = await render(createElement(AdminDispatchList));
  assert.equal(direct.container.querySelector('a[data-slot="dispatch-row"]')?.getAttribute("href"), "/admin/messaging?foo=1&dispatch=d1");
  const modal = direct.container.querySelector('[data-testid="modal"]');
  assert.ok(modal, "一覧の上にモーダルが開く");
  assert.equal(modal.querySelector("h2")?.textContent, "送信の詳細: 春のセール");
  assert.deepEqual([...modal.querySelectorAll("nav button")].map((el) => el.textContent), ["基本情報", "送信状況", "プレビュー"]);
  await direct.click(direct.container.querySelector('[data-testid="modal-close"]'));
  assert.deepEqual(routerCalls, ["replace:/admin/messaging?foo=1"]);
  await direct.unmount();

  // 行から開いた: 閉じると「戻る」
  routerCalls.length = 0;
  nav.search = "dispatch=d1";
  const fromRow = await render(createElement(AdminDispatchList));
  await fromRow.click(fromRow.container.querySelector('a[data-slot="dispatch-row"]'));
  await fromRow.click(fromRow.container.querySelector('[data-testid="modal-close"]'));
  assert.deepEqual(routerCalls, ["back"]);
  await fromRow.unmount();
});

test("詳細: 種別・カテゴリーの表示名、送り元は表示名がある時だけ、鍵は出さない", async () => {
  const view = await renderDetail();
  const text = view.text();
  assert.match(text, /種類プロモーション/);
  assert.match(text, /カテゴリーキャンペーン/);
  assert.match(text, /送信方法メール \/ お知らせ/);
  assert.doesNotMatch(text, /送信元/, "表示名が無ければ行ごと出さない");
  assert.doesNotMatch(text, /定義の鍵/);
  assert.doesNotMatch(text, KEY_LIKE);
  await view.unmount();

  detail = { ...DISPATCH, sourceLabel: "管理者の一括送信", category: "gone" };
  const labeled = await renderDetail();
  assert.match(labeled.text(), /送信元管理者の一括送信/);
  assert.match(labeled.text(), /削除されたカテゴリー/);
  assert.doesNotMatch(labeled.text(), /messaging\.adminBulk|\bgone\b/);
  await labeled.unmount();
});

test("詳細: テンプレートの行は版の番号、消したテンプレートは「削除されたテンプレート(v<n>)」、システムテンプレートは鍵を出さない", async () => {
  const none = await renderDetail();
  assert.doesNotMatch(none.text(), /テンプレート/, "テンプレートから送っていない回は行ごと出さない");
  await none.unmount();

  const cases: { over: Partial<AdminDispatchDetail>; expected: RegExp }[] = [
    { over: { templateId: "t1", templateVersion: 3 }, expected: /テンプレートv3送信方法/ },
    { over: { templateId: "t1", templateVersion: 2, templateEdited: true }, expected: /テンプレートv2\(文言を直して送信\)送信方法/ },
    { over: { templateId: null, templateVersion: 3, templateDeleted: true }, expected: /テンプレート削除されたテンプレート\(v3\)送信方法/ },
    {
      over: { templateId: null, templateVersion: 4, templateDeleted: true, templateEdited: true },
      expected: /テンプレート削除されたテンプレート\(v4・文言を直して送信\)送信方法/,
    },
    { over: { systemTemplate: "blank.noticeSystem" }, expected: /テンプレートシステムテンプレート送信方法/ },
  ];
  for (const { over, expected } of cases) {
    detail = { ...DISPATCH, ...over };
    const view = await renderDetail();
    assert.match(view.text(), expected, JSON.stringify(over));
    assert.doesNotMatch(view.text(), /\bt1\b|blank\.noticeSystem/, "テンプレートの id・システムテンプレートの鍵は出さない");
    await view.unmount();
  }
});

test("詳細: 送信者は名前、配達は利用者の名前・表に無い符号は決まった文", async () => {
  const UID = "60ce3c85-1111-4111-8111-111111111111";
  deliveryItems = [
    delivery({ id: "v1", recipientKey: `user:${UID}`, userId: UID, userName: "山田", address: UID, channel: "inApp", status: "failed", reason: "weird_reason", errorCode: "http_403" }),
    delivery({ id: "v2", recipientKey: "user:x", userId: "x", userName: null, address: "a@example.test", channel: "email", status: "sent" }),
  ];
  const view = await renderDetail();
  assert.match(view.text(), /送信者管理者 A/);
  assert.doesNotMatch(view.text(), /\ba1\b/, "送った人の id は出さない");
  const deliveries = await openTab(view, "deliveries");
  assert.match(deliveries, /宛先 山田/);
  assert.match(deliveries, /宛先 \(名前未設定のユーザー\)/);
  assert.match(deliveries, /a@example\.test/, "メールの宛先は出す");
  assert.doesNotMatch(view.text(), new RegExp(UID), "利用者の id・お知らせの宛先は出さない");
  assert.match(deliveries, /送信できませんでした/);
  assert.doesNotMatch(view.text(), /http_403|weird_reason/);
  assert.match(deliveries, /その他/);
  await view.unmount();

  detail = { ...DISPATCH, actorName: null, actor: { id: null, type: "system" } };
  const system = await renderDetail();
  assert.match(system.text(), /送信者システム/);
  await system.unmount();
});

test("詳細(プレビュー): 前の形の回の本文を経路ごとに出し、生の JSON は出さない", async () => {
  detail = {
    ...DISPATCH,
    record: "vars",
    body: { email: { subject: "春のセール", paragraphs: ["本文の段落"] }, inApp: { title: "春", body: "お知らせの本文" } },
  };
  const view = await renderDetail();
  const preview = await openTab(view, "preview");
  assert.match(preview, /本文の段落/);
  assert.match(preview, /お知らせの本文/);
  assert.doesNotMatch(preview, /\{"/, "生の JSON は出さない");
  assert.doesNotMatch(preview, KEY_LIKE);
  await view.unmount();
});

test("グループ宛ての回: 一覧の行と詳細にグループの名前、名前が無ければ「グループ」、id は出さない", async () => {
  const GROUP_ID = "44444444-4444-4444-8444-444444444444";
  const named: AdminDispatchDetail = { ...DISPATCH, id: "d2", targetGroup: { id: GROUP_ID, name: "常連" } };
  const unnamed: AdminDispatchDetail = { ...DISPATCH, id: "d3", targetGroup: { id: GROUP_ID, name: null } };
  listItems = [named, unnamed, DISPATCH];
  const list = await render(createElement(AdminDispatchList));
  const targets = [...list.container.querySelectorAll('[data-slot="dispatch-target"]')].map((el) => el.textContent);
  assert.deepEqual(targets, ["グループ「常連」・2 名", "グループ・2 名", "2 名"]);
  assert.doesNotMatch(list.text(), new RegExp(GROUP_ID));
  assert.doesNotMatch(
    [...list.container.querySelectorAll("a")].map((el) => el.getAttribute("href")).join(" "),
    new RegExp(GROUP_ID),
    "行の住所にも出さない",
  );
  await list.unmount();

  detail = named;
  const shown = await renderDetail("d2");
  assert.match(shown.text(), /宛先グループ「常連」/);
  assert.doesNotMatch(shown.text(), new RegExp(GROUP_ID));
  await shown.unmount();
  detail = unnamed;
  const bare = await renderDetail("d3");
  assert.match(bare.text(), /宛先グループ宛先数/);
  assert.doesNotMatch(bare.text(), new RegExp(GROUP_ID));
  await bare.unmount();
  detail = { ...DISPATCH };
  const plain = await renderDetail();
  assert.doesNotMatch(plain.text(), /宛先グループ/);
  await plain.unmount();
});
