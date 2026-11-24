// 送信の詳細と利用者ごとの履歴の公開の hook の検査(jsdom の上で描く。client service は偽物、D210・D215)。
// - useDispatchReaders: 送信の既読した利用者をカーソルで取る(limit を渡す)、送信が無ければ取らない、続きの印で hasMore
// - useUserMessageHistory: 利用者の履歴をカーソルで取る、sentBy を渡す、利用者が無ければ取らない
// 実行: pnpm test src/domains/core/messaging/hooks/dispatchViewHooks.test.tsx
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

const calls: unknown[][] = [];
mock.module("@/domains/core/messaging/services/client/dispatchReadersClient", {
  namedExports: {
    getAdminDispatchReaders: async (dispatchId: string, params: unknown) => {
      calls.push(["readers", dispatchId, params]);
      return { items: [{ userId: "u1", name: "花子", readAt: "2026-11-01T00:00:00.000Z" }], nextCursor: "c2" };
    },
  },
});
const HISTORY_ROW = {
  type: "sharedInApp",
  dispatchId: "d1",
  messageKey: null,
  kind: "notice",
  source: "messaging.adminBroadcast",
  actor: { id: "a1", type: "admin" },
  reason: null,
  headings: { inApp: "お知らせ" },
  channels: [{ channel: "inApp", status: null, sentAt: null }],
  createdAt: "2026-11-01T00:00:00.000Z",
};
mock.module("@/domains/core/messaging/services/client/userHistoryClient", {
  namedExports: {
    getAdminUserMessageHistory: async (userId: string, params: unknown) => {
      calls.push(["history", userId, params]);
      return { items: [HISTORY_ROW], nextCursor: null };
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let hooks: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hooks = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
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
  await act(async () =>
    root.render(
      createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        createElement(Probe, { report: (value: T) => (latest.current = value) }),
      ),
    ),
  );
  return { value: () => latest.current!, unmount: () => act(async () => root.unmount()) };
};
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)));

test("useDispatchReaders / useUserMessageHistory: id が無ければ取らない", async () => {
  const none = await mount(() => ({ readers: hooks.useDispatchReaders(null), history: hooks.useUserMessageHistory(null) }));
  await settle();
  assert.equal(calls.length, 0);
  assert.deepEqual(none.value().readers.items, []);
  assert.deepEqual(none.value().history.items, []);
  await none.unmount();
});

test("useDispatchReaders: 送信の既読した利用者をカーソルで取る(続きがあれば hasMore)", async () => {
  const view = await mount(() => hooks.useDispatchReaders("d1", { limit: 20 }));
  await settle();
  assert.deepEqual(calls[0], ["readers", "d1", { cursor: null, limit: 20 }]);
  assert.deepEqual(view.value().items, [{ userId: "u1", name: "花子", readAt: "2026-11-01T00:00:00.000Z" }]);
  assert.equal(view.value().hasMore, true);
  await view.unmount();
});

test("useUserMessageHistory: 利用者の履歴をカーソルで取る(共有のお知らせの行も同じ形)", async () => {
  const view = await mount(() => hooks.useUserMessageHistory("u1"));
  await settle();
  assert.deepEqual(calls[0], ["history", "u1", { cursor: null, limit: 50, sentBy: undefined }]);
  assert.deepEqual(view.value().items, [HISTORY_ROW]);
  assert.equal(view.value().hasMore, false);
  await view.unmount();
});

test("useUserMessageHistory: sentBy(admin = 運営の送信だけ)を client へ渡す", async () => {
  const view = await mount(() => hooks.useUserMessageHistory("u1", { sentBy: "admin" }));
  await settle();
  assert.deepEqual(calls[0], ["history", "u1", { cursor: null, limit: 50, sentBy: "admin" }]);
  await view.unmount();
});
