// 受け取り箱の hook の検査(jsdom の上で描く。client service は偽物)。
// - useInboxItems: 先頭は cursor なし、続きは前の nextCursor、nextCursor null で終端、unreadOnly を渡す
// - useMarkInboxItemRead / useMarkAllInboxRead: client を呼び、未読の数(useInboxUnreadCount)を取り直す
// 実行: pnpm test src/features/core/messaging/hooks/inboxHooks.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
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

type Item = { id: string; title: string | null; body: string; link: null; image: null; metadata: null; publishedAt: string; read: boolean };
const item = (id: string): Item => ({ id, title: id, body: "b", link: null, image: null, metadata: null, publishedAt: "2026-11-01T00:00:00.000Z", read: false });

const listCalls: { cursor?: string | null; limit?: number; unreadOnly?: boolean }[] = [];
const reads: string[] = [];
let readAlls = 0;
let countCalls = 0;
mock.module("@/features/core/messaging/services/client/inboxClient", {
  namedExports: {
    listInbox: async (params: { cursor?: string | null; limit?: number; unreadOnly?: boolean }) => {
      listCalls.push(params);
      if (!params.cursor) return { items: [item("a"), item("b")], nextCursor: "cur-b" };
      return { items: [item("c")], nextCursor: null };
    },
    getInboxUnreadCount: async () => {
      countCalls += 1;
      return 3;
    },
    markInboxRead: async (id: string) => {
      reads.push(id);
    },
    markAllInboxRead: async () => {
      readAlls += 1;
    },
  },
});

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
  reads.length = 0;
  readAlls = 0;
  countCalls = 0;
});

/** フックを描き、最新の返り値を返す(SWR のキャッシュは描くたびに新しくする) */
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

test("useInboxItems: 先頭は cursor なし → 続きは nextCursor → null で終端", async () => {
  const view = await mount(() => hooks.useInboxItems({ unreadOnly: true, limit: 2 }));
  assert.deepEqual(view.value().items.map((i) => i.id), ["a", "b"]);
  assert.equal(view.value().hasMore, true);
  await act(async () => view.value().loadMore());
  assert.deepEqual(view.value().items.map((i) => i.id), ["a", "b", "c"]);
  assert.equal(view.value().hasMore, false);
  assert.deepEqual(listCalls, [
    { cursor: null, limit: 2, unreadOnly: true },
    { cursor: "cur-b", limit: 2, unreadOnly: true },
  ]);
  await view.unmount();
});

test("useInboxItems: enabled false の間は取らない", async () => {
  const view = await mount(() => hooks.useInboxItems({ enabled: false }));
  assert.equal(listCalls.length, 0);
  assert.equal(view.value().isInitialLoading, false);
  await view.unmount();
});

test("既読の hook は client を呼び、未読の数を取り直す", async () => {
  const view = await mount(() => ({
    count: hooks.useInboxUnreadCount(),
    one: hooks.useMarkInboxItemRead(),
    all: hooks.useMarkAllInboxRead(),
  }));
  assert.equal(view.value().count.count, 3);
  const before = countCalls;

  await act(async () => {
    await view.value().one.markRead("a");
  });
  assert.deepEqual(reads, ["a"]);
  assert.ok(countCalls > before, "1 件の既読の後に未読の数を取り直す");

  const afterOne = countCalls;
  await act(async () => {
    await view.value().all.markAllRead();
  });
  assert.equal(readAlls, 1);
  assert.ok(countCalls > afterOne, "全部既読の後に未読の数を取り直す");
  await view.unmount();
});

test("useInboxUnreadCount: enabled false は取らず 0", async () => {
  const view = await mount(() => hooks.useInboxUnreadCount({ enabled: false }));
  assert.equal(countCalls, 0);
  assert.equal(view.value().count, 0);
  await view.unmount();
});
