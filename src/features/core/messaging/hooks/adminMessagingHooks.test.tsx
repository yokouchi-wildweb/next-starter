// 管理の送信の hook の検査(jsdom の上で描く。client service は偽物)。
// - useAdminDispatches: 絞り込みを毎回渡し、先頭は cursor なし、続きは前の nextCursor、null で終端
// - useAdminDispatchDeliveries: 送信の id と絞り込みを渡す
// - useContinueDispatch: client を呼び、送信 1 件(useAdminDispatch)を取り直す
// - useDeleteDispatch / useResendDispatch: client を呼び、送信 1 件を取り直す(D88: 取り消し・取り下げは削除に替わった)
// - useDispatchDeleteSummary: 確認を開いている間(enabled かつ ids あり)だけ見込みを取る
// - useBulkDeleteDispatches: client を呼び、消せた id を返して知らせる(できなかった分も数える)、失敗は知らせて空
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

const summary = (id: string) => ({ id, headings: {}, messageKey: null });
const listCalls: Record<string, unknown>[] = [];
const deliveryCalls: { id: string; params: Record<string, unknown> }[] = [];
const sends: Record<string, unknown>[] = [];
let detailCalls = 0;
let continues = 0;
const operations: unknown[][] = [];
let failBulk = false;
mock.module("@/features/core/messaging/services/client/adminMessagingClient", {
  namedExports: {
    deleteAdminDispatch: async (id: string) => {
      operations.push(["delete", id]);
      return { dispatchId: id, alreadyDeleted: false, canceledDeliveries: 2, removed: [{ channel: "inApp", removed: 1 }], failedChannels: [] };
    },
    bulkDeleteAdminDispatches: async (ids: readonly string[]) => {
      operations.push(["bulkDelete", [...ids]]);
      if (failBulk) throw new Error("だめ");
      return {
        results: ids.map((id) =>
          id === "locked"
            ? { dispatchId: id, ok: false, reason: "not_found", message: "見つかりません" }
            : { dispatchId: id, ok: true, result: { dispatchId: id, alreadyDeleted: false, canceledDeliveries: 0, removed: [], failedChannels: [] } },
        ),
      };
    },
    adminDispatchDeleteSummary: async (ids: readonly string[]) => {
      operations.push(["deleteSummary", [...ids]]);
      return { found: ids.length, deleted: 0, scheduled: 1, unsent: 2, channels: [{ key: "inApp", label: "お知らせ", removable: true, sent: 3 }], sharedInbox: 0 };
    },
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
      return { id, status: "processing", deletedAt: null, operations: { canDelete: { allowed: true, reason: null }, canResend: { allowed: true, reason: null, mode: "requeue", failed: 1, unknown: 0 }, canContinue: { allowed: true, reason: null } } };
    },
    continueAdminDispatch: async () => {
      continues += 1;
      return { expanded: false, claimed: 1, sent: 1, failed: 0, completed: false };
    },
    resendAdminDispatch: async (id: string, input: unknown) => {
      operations.push(["resend", id, input]);
      return { dispatchId: id, mode: "requeue", failed: 1, unknown: 0, newDispatchId: null };
    },
    getAdminBulkSendOptions: async () => ({
      categories: [
        { key: "operatorDirect", label: "運営からのご連絡", kind: "direct", channels: ["email", "inApp"], targets: ["users", "bulk"], adhoc: true },
        { key: "promotion", label: "キャンペーン情報", kind: "promotion", channels: ["email", "inApp"], targets: ["bulk"], adhoc: true },
      ],
    }),
    adminBulkSend: async (input: Record<string, unknown>) => {
      sends.push(input);
      return { dispatchId: "disp-1", status: "completed", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 0 } };
    },
  },
});
const toasts: string[] = [];
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: (m: string, kind: string) => void toasts.push(`${kind}:${m}`) }) } });

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
  toasts.length = 0;
  failBulk = false;
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
  const view = await mount(() => hooks.useAdminDispatches({ filters: { status: "processing", kind: "promotion" }, limit: 2 }));
  assert.deepEqual(view.value().items.map((i) => i.id), ["a", "b"]);
  await act(async () => view.value().loadMore());
  assert.deepEqual(view.value().items.map((i) => i.id), ["a", "b", "c"]);
  assert.equal(view.value().hasMore, false);
  assert.equal(listCalls[0].cursor, null);
  assert.equal(listCalls[0].status, "processing");
  assert.equal(listCalls[0].kind, "promotion");
  assert.equal(listCalls[1].cursor, "cur-b");
  await view.unmount();
});

test("useAdminDispatchDeliveries: 送信の id と絞り込みを渡す", async () => {
  const view = await mount(() => hooks.useAdminDispatchDeliveries("disp-9", { filters: { channel: "email" } }));
  assert.deepEqual(view.value().items.map((i) => i.id), ["d1"]);
  assert.equal(deliveryCalls[0].id, "disp-9");
  assert.equal(deliveryCalls[0].params.channel, "email");
  await view.unmount();
});

test("useContinueDispatch: client を呼び、送信 1 件を取り直す", async () => {
  const view = await mount(() => ({ one: hooks.useAdminDispatch("disp-1"), cont: hooks.useContinueDispatch("disp-1") }));
  assert.equal(view.value().one.dispatch?.id, "disp-1");
  const beforeCalls = detailCalls;
  await act(async () => {
    await view.value().cont.continueSending();
  });
  assert.equal(continues, 1);
  assert.ok(detailCalls > beforeCalls, "続きを送った後に送信を取り直す");
  await view.unmount();
});

test("削除・再送の hook: client を呼び、送信 1 件を取り直す", async () => {
  const view = await mount(() => ({
    one: hooks.useAdminDispatch("disp-1"),
    remove: hooks.useDeleteDispatch("disp-1"),
    resend: hooks.useResendDispatch("disp-1"),
  }));
  assert.equal(view.value().one.dispatch?.operations.canDelete.allowed, true);
  const before = detailCalls;
  await act(async () => {
    const res = await view.value().remove.trigger();
    assert.equal(res.canceledDeliveries, 2);
  });
  const afterDelete = detailCalls;
  assert.ok(afterDelete > before, "削除の後に送信を取り直す");
  await act(async () => {
    const res = await view.value().resend.trigger({ includeUnknown: true });
    assert.equal(res.mode, "requeue");
  });
  assert.deepEqual(operations, [
    ["delete", "disp-1"],
    ["resend", "disp-1", { includeUnknown: true }],
  ]);
  assert.ok(detailCalls > afterDelete, "再送の後も送信を取り直す");
  await view.unmount();
});

test("useDispatchDeleteSummary: 確認を開いている間(enabled かつ ids あり)だけ見込みを取る", async () => {
  const closed = await mount(() => hooks.useDispatchDeleteSummary(["b", "a"], false));
  const empty = await mount(() => hooks.useDispatchDeleteSummary([], true));
  assert.equal(closed.value().summary, null);
  assert.equal(empty.value().summary, null);
  assert.deepEqual(operations, [], "閉じている間・ids が空の間は取らない");
  await closed.unmount();
  await empty.unmount();

  const open = await mount(() => hooks.useDispatchDeleteSummary(["b", "a"], true));
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  assert.deepEqual(operations, [["deleteSummary", ["b", "a"]]]);
  assert.equal(open.value().summary?.found, 2);
  assert.equal(open.value().summary?.unsent, 2);
  assert.equal(open.value().isLoading, false);
  assert.equal(open.value().error, null);
  await open.unmount();
});

test("useBulkDeleteDispatches: 消せた id を返して知らせる、できなかった分も数える、失敗は知らせて空", async () => {
  const view = await mount(() => hooks.useBulkDeleteDispatches());
  assert.equal(hooks.DISPATCH_DELETE_MAX, 100);
  let done: string[] = [];
  await act(async () => {
    done = await view.value().remove(["a", "b"]);
  });
  assert.deepEqual(done, ["a", "b"]);
  assert.equal(toasts.at(-1), "success:2 件を削除しました");
  await act(async () => {
    done = await view.value().remove(["a", "locked"]);
  });
  assert.deepEqual(done, ["a"]);
  assert.equal(toasts.at(-1), "warning:1 件を削除しました(1 件は削除できませんでした)");
  failBulk = true;
  await act(async () => {
    done = await view.value().remove(["a"]);
  });
  assert.deepEqual(done, []);
  assert.equal(toasts.at(-1), "error:だめ");
  assert.deepEqual(operations, [
    ["bulkDelete", ["a", "b"]],
    ["bulkDelete", ["a", "locked"]],
    ["bulkDelete", ["a"]],
  ]);
  await view.unmount();
});
