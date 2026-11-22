// 送信の詳細の塊(AdminDispatchDetail の入口)の検査(jsdom の上で描く。D210)。
// - 全員宛ての送信の基本情報は宛先の指定と人数だけ(利用者を並べない)、メタデータ(送信者・出どころ・作成日時・送信方法)
// - ロール宛ての送信はロールの表示名(利用者のドメインのロールの設定、無いロールは id)
// - タブ: 既読した利用者はサービス内通知を含む送信だけ
// 実行: pnpm test src/domains/core/messaging/components/AdminDispatchDetail/AdminDispatchDetail.test.tsx
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { AdminDispatchDetail } from "@/domains/core/messaging/services/client/adminMessagingClient";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

mock.module("next/navigation", {
  namedExports: {
    usePathname: () => "/admin/messaging",
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {}, refresh: () => {}, prefetch: () => {} }),
    useParams: () => ({}),
    useSelectedLayoutSegments: () => [],
    redirect: () => {},
    notFound: () => {},
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let detail: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  detail = await import("./index");
});
after(() => dom.window.close());

const DISPATCH = {
  id: "d1",
  messageKey: null,
  kind: "notice",
  category: null,
  source: "messaging.adminBroadcast",
  status: "completed",
  channels: ["email", "inApp"],
  headings: { email: "お知らせ" },
  recipientCount: 1200,
  channelCounts: null,
  actor: { id: "a1", type: "admin" },
  isTest: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  completedAt: null,
  scheduledAt: null,
  deletedAt: null,
  targetGroup: null,
  record: null,
  target: { type: "all", count: 1200 },
  tags: [],
  reason: null,
  metadata: null,
  templateId: null,
  templateVersion: null,
  templateDeleted: false,
  templateEdited: false,
  editedFields: null,
  content: { layout: "notice", layoutVersion: 1, values: {} },
  targetUserIds: null,
  sourceLabel: null,
  actorName: "管理者 A",
  body: null,
  vars: null,
  sameAs: null,
  operations: {},
} as unknown as AdminDispatchDetail;

const renderSummary = async (dispatch: AdminDispatchDetail) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(detail.DispatchSummaryBlock, { dispatch, categoryLabel: null })));
  return { container, text: () => container.textContent ?? "", unmount: () => act(async () => root.unmount()) };
};

test("全員宛ての送信の基本情報は宛先の指定と人数だけで、利用者を並べない", async () => {
  const view = await renderSummary(DISPATCH);
  const target = view.container.querySelector("[data-slot=dispatch-target-summary]")?.textContent ?? "";
  assert.equal(target, "宛先全員 1200 名");
  assert.equal(view.container.querySelectorAll("li, [data-slot=dispatch-reader-row], [data-slot=delivery-row]").length, 0, "利用者の一覧は無い");
  assert.doesNotMatch(view.text(), /選んだ利用者/);
  const meta = view.container.querySelector("[data-slot=dispatch-meta]")?.textContent ?? "";
  assert.match(meta, /送信者管理者 A/);
  assert.match(meta, /出どころレイアウトから作成/);
  assert.match(meta, /送信方法メール \/ サービス内通知/);
  assert.doesNotMatch(view.text(), /messaging\.adminBroadcast|\ba1\b/, "鍵・id は出さない");
  await view.unmount();
});

test("ロール宛ての送信はロールの表示名(無いロールは id)", async () => {
  const view = await renderSummary({ ...DISPATCH, target: { type: "role", roles: ["admin", "no_such_role"], count: 3 } } as AdminDispatchDetail);
  const target = view.container.querySelector("[data-slot=dispatch-target-summary]")?.textContent ?? "";
  assert.match(target, new RegExp(`ロール「${detail.dispatchRoleLabelOf("admin")}・no_such_role」 3 名`));
  assert.notEqual(detail.dispatchRoleLabelOf("admin"), "admin", "core のロールは表示名");
  await view.unmount();
});

test("既読した利用者のタブはサービス内通知を含む送信だけ", () => {
  assert.deepEqual(
    detail.dispatchDetailTabs({ channels: ["email", "inApp"] }).map((tab) => tab.value),
    ["summary", "deliveries", "preview", "readers"],
  );
  assert.deepEqual(detail.dispatchDetailTabs({ channels: ["email"] }).map((tab) => tab.value), ["summary", "deliveries", "preview"]);
});
