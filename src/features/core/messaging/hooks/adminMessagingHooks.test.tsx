// 管理の送信と回の hook の検査(jsdom の上で描く。client service は偽物)。
// - useAdminDispatches: 絞り込みを毎回渡し、先頭は cursor なし、続きは前の nextCursor、null で終端
// - useAdminDispatchDeliveries: 回の id と絞り込みを渡す
// - useContinueDispatch: client を呼び、回 1 件(useAdminDispatch)を取り直す
// - useCancelDispatch / useRetractDispatch / useResendDispatch: client を呼び、回 1 件を取り直す
// - 一括送信の流れは送るモーダルの hook(sendModalHooks.test.tsx)
// 実行: pnpm test src/features/core/messaging/hooks/adminMessagingHooks.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const summary = (id: string) => ({ id, headings: {}, messageKey: "messaging.adminMarketing" });
const listCalls: Record<string, unknown>[] = [];
const deliveryCalls: { id: string; params: Record<string, unknown> }[] = [];
const sends: Record<string, unknown>[] = [];
let detailCalls = 0;
let continues = 0;
const operations: unknown[][] = [];
mock.module("@/features/core/messaging/services/client/adminMessagingClient", {
  namedExports: {
    listAdminDispatches: async (params: Record<string, unknown>) => {
      listCalls.push(params);
      if (!params.cursor) return { items: [summary("a"), summary("b")], nextCursor: "cur-b" };
      return { items: [summary("c")], nextCursor: null };
    },
    listAdminDispatchDeliveries: async (id: string, params: Record<string, unknown>) => {
      deliveryCalls.push({ id, params });
      return { items: [{ id: "d1" }], nextCursor: null };
    },
    getAdminDispatch: async (id: string) => {
      detailCalls += 1;
      return { id, status: "processing" };
    },
    continueAdminDispatch: async () => {
      continues += 1;
      return { expanded: false, claimed: 1, sent: 1, failed: 0, completed: false };
    },
    cancelAdminDispatch: async (id: string) => {
      operations.push(["cancel", id]);
      return { dispatchId: id, status: "cancelled" };
    },
    retractAdminDispatch: async (id: string) => {
      operations.push(["retract", id]);
      return { dispatchId: id, deletedInboxItems: 1, canceledDeliveries: 2, detachedImages: 0 };
    },
    resendAdminDispatch: async (id: string, input: unknown) => {
      operations.push(["resend", id, input]);
      return { dispatchId: id, mode: "requeue", failed: 1, unknown: 0, newDispatchId: null };
    },
    getAdminBulkSendOptions: async () => ({
      categories: [
        { key: "operatorDirect", label: "運営からのご連絡", kind: "direct", channels: ["email", "inApp"], audiences: ["users", "bulk"], adhoc: true },
        { key: "marketing", label: "キャンペーン情報", kind: "marketing", channels: ["email", "inApp"], audiences: ["bulk"], adhoc: true },
      ],
    }),
    adminBulkSend: async (input: Record<string, unknown>) => {
      sends.push(input);
      return { dispatchId: "disp-1", status: "completed", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 0 }, afterSend: { ok: true } };
    },
  },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let hooks: typeof import("./index");
let SWRConfig: typeof import("swr").SWRConfig;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hooks = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  listCalls.length = 0;
  deliveryCalls.length = 0;
  sends.length = 0;
  detailCalls = 0;
  continues = 0;
  operations.length = 0;
});

const mount = async <T,>(useHook: () => T) => {
  const latest: { current: T | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const Probe = ({ report }: { report: (value: T) => void }) => {
    report(useHook());
    return null;
  };
  await act(async () => {
    root.render(
      createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        createElement(Probe, { report: (value: T) => (latest.current = value) }),
      ),
    );
  });
  return { value: () => latest.current!, unmount: () => act(async () => root.unmount()) };
};

test("useAdminDispatches: 絞り込みを渡し、先頭は cursor なし → 続きは nextCursor → null で終端", async () => {
  const view = await mount(() => hooks.useAdminDispatches({ filters: { status: "processing", kind: "marketing" }, limit: 2 }));
  assert.deepEqual(view.value().items.map((i) => i.id), ["a", "b"]);
  await act(async () => view.value().loadMore());
  assert.deepEqual(view.value().items.map((i) => i.id), ["a", "b", "c"]);
  assert.equal(view.value().hasMore, false);
  assert.equal(listCalls[0].cursor, null);
  assert.equal(listCalls[0].status, "processing");
  assert.equal(listCalls[0].kind, "marketing");
  assert.equal(listCalls[1].cursor, "cur-b");
  await view.unmount();
});

test("useAdminDispatchDeliveries: 回の id と絞り込みを渡す", async () => {
  const view = await mount(() => hooks.useAdminDispatchDeliveries("disp-9", { filters: { channel: "email" } }));
  assert.deepEqual(view.value().items.map((i) => i.id), ["d1"]);
  assert.equal(deliveryCalls[0].id, "disp-9");
  assert.equal(deliveryCalls[0].params.channel, "email");
  await view.unmount();
});

test("useContinueDispatch: client を呼び、回 1 件を取り直す", async () => {
  const view = await mount(() => ({ one: hooks.useAdminDispatch("disp-1"), cont: hooks.useContinueDispatch("disp-1") }));
  assert.equal(view.value().one.dispatch?.id, "disp-1");
  const beforeCalls = detailCalls;
  await act(async () => {
    await view.value().cont.continueSending();
  });
  assert.equal(continues, 1);
  assert.ok(detailCalls > beforeCalls, "続きを送った後に回を取り直す");
  await view.unmount();
});

test("取り消し・取り下げ・再送の hook: client を呼び、回 1 件を取り直す", async () => {
  const view = await mount(() => ({
    one: hooks.useAdminDispatch("disp-1"),
    cancel: hooks.useCancelDispatch("disp-1"),
    retract: hooks.useRetractDispatch("disp-1"),
    resend: hooks.useResendDispatch("disp-1"),
  }));
  const before = detailCalls;
  await act(async () => {
    await view.value().cancel.trigger();
  });
  const afterCancel = detailCalls;
  assert.ok(afterCancel > before, "取り消しの後に回を取り直す");
  await act(async () => {
    await view.value().retract.trigger();
    await view.value().resend.trigger({ includeUnknown: true });
  });
  assert.deepEqual(operations, [
    ["cancel", "disp-1"],
    ["retract", "disp-1"],
    ["resend", "disp-1", { includeUnknown: true }],
  ]);
  assert.ok(detailCalls > afterCancel, "取り下げ・再送の後も回を取り直す");
  await view.unmount();
});
