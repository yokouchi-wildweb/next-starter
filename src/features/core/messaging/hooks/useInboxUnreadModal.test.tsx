// useInboxUnreadModal の検査(jsdom の上で描く。住所・ログイン・受け取り箱の hook は偽物)。
// - 門 messagingInbox 閉(enabled を渡しても)/ config 切 / 住所の外 / 未ログインは取らず開かない。既定(config 既定 入)は開く
// - 確かめていない未読を古い順に開き、見せた行に確かめた印(sessionStorage)を付けて既読にする
// - 確かめた行は次に開かない / next / skip(全部既読 + 全部に印 + 閉じる)/ isInboxModalPath
// 実行: pnpm test src/features/core/messaging/hooks/useInboxUnreadModal.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.sessionStorage = dom.window.sessionStorage;
g.IS_REACT_ACT_ENVIRONMENT = true;

type Item = { id: string; title: string; body: string; link: null; image: null; metadata: null; publishedAt: string; read: boolean };
const item = (id: string, at: string): Item => ({ id, title: id, body: "b", link: null, image: null, metadata: null, publishedAt: at, read: false });

let pathname = "/";
let user: unknown = { userId: "u1" };
let items: Item[] = [];
const fetchEnabled: boolean[] = [];
const reads: string[] = [];
let readAlls = 0;
let inboxOpen = true;
const gateReads: string[] = [];
mock.module("@/featureGate/client", {
  namedExports: { useGate: () => ({ enabled: (name: string) => (gateReads.push(name), inboxOpen) }) },
});
mock.module(pathToFileURL(require.resolve("next/navigation")).href, { namedExports: { usePathname: () => pathname } });
mock.module("@/features/core/auth/hooks/useAuthSession", { namedExports: { useAuthSession: () => ({ user }) } });
mock.module("@/features/core/messaging/hooks/useInboxItems", {
  namedExports: {
    useInboxItems: (options: { enabled?: boolean }) => {
      fetchEnabled.push(Boolean(options.enabled));
      return { items: options.enabled ? items : [], isLoading: false, revalidate: () => {} };
    },
  },
});
mock.module("@/features/core/messaging/hooks/useMarkInboxItemRead", {
  namedExports: { useMarkInboxItemRead: () => ({ markRead: async (id: string) => void reads.push(id) }) },
});
mock.module("@/features/core/messaging/hooks/useMarkAllInboxRead", {
  namedExports: { useMarkAllInboxRead: () => ({ markAllRead: async () => void (readAlls += 1) }) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let mod: typeof import("./useInboxUnreadModal");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  mod = await import("./useInboxUnreadModal");
});
after(() => dom.window.close());
beforeEach(() => {
  pathname = "/";
  user = { userId: "u1" };
  items = [item("new", "2026-11-02T00:00:00Z"), item("old", "2026-11-01T00:00:00Z")];
  fetchEnabled.length = 0;
  reads.length = 0;
  readAlls = 0;
  inboxOpen = true;
  gateReads.length = 0;
  sessionStorage.clear();
});

type Hook = ReturnType<typeof import("./useInboxUnreadModal").useInboxUnreadModal>;
const mount = async (options: Parameters<typeof import("./useInboxUnreadModal").useInboxUnreadModal>[0] = { enabled: true, paths: ["/"] }) => {
  const latest: { current: Hook | null } = { current: null };
  const root = createRoot(document.createElement("div"));
  const Probe = () => {
    latest.current = mod.useInboxUnreadModal(options);
    return null;
  };
  await act(async () => root.render(createElement(Probe)));
  return { hook: () => latest.current!, unmount: () => act(async () => root.unmount()) };
};
const confirmed = () => JSON.parse(sessionStorage.getItem(mod.INBOX_MODAL_CONFIRMED_IDS_KEY) ?? "[]") as string[];

test("isInboxModalPath: 完全一致と末尾 * の前方一致", () => {
  assert.equal(mod.isInboxModalPath("/", ["/"]), true);
  assert.equal(mod.isInboxModalPath("/wallet/coin", ["/wallet/*"]), true);
  assert.equal(mod.isInboxModalPath("/mypage", ["/", "/wallet/*"]), false);
});

test("config 切・住所の外・未ログインは取らず開かない", async () => {
  for (const [options, setup] of [
    [{ enabled: false, paths: ["/"] }, () => {}],
    [{ enabled: true, paths: ["/"] }, () => void (pathname = "/mypage")],
    [{ enabled: true, paths: ["/"] }, () => void (user = null)],
  ] as const) {
    setup();
    fetchEnabled.length = 0;
    const view = await mount(options);
    assert.ok(fetchEnabled.every((e) => !e), "取らない");
    assert.equal(view.hook().open, false);
    await view.unmount();
    pathname = "/";
    user = { userId: "u1" };
  }
});

test("門 messagingInbox が閉なら enabled: true でも取らず開かない", async () => {
  inboxOpen = false;
  const view = await mount({ enabled: true, paths: ["/"] });
  assert.ok(gateReads.includes("messagingInbox"));
  assert.ok(fetchEnabled.length > 0 && fetchEnabled.every((e) => !e), "取らない");
  assert.equal(view.hook().open, false);
  await view.unmount();
});

test("引数なし = config の既定(showUnreadModal 入・住所 [\"/\"])で開く", async () => {
  const view = await mount({});
  assert.equal(view.hook().open, true);
  await view.unmount();
});

test("古い順に開き、見せた行に印を付けて既読。next で次へ", async () => {
  const view = await mount();
  assert.equal(view.hook().open, true);
  assert.equal(view.hook().current?.id, "old");
  assert.equal(view.hook().total, 2);
  assert.deepEqual(reads, ["old"]);
  assert.deepEqual(confirmed(), ["old"]);
  await act(async () => view.hook().next());
  assert.equal(view.hook().current?.id, "new");
  assert.equal(view.hook().isLast, true);
  assert.deepEqual(reads, ["old", "new"]);
  await act(async () => view.hook().close());
  assert.equal(view.hook().open, false);
  await view.unmount();
});

test("確かめた行は開かない。skip は全部既読 + 全部に印 + 閉じる", async () => {
  sessionStorage.setItem(mod.INBOX_MODAL_CONFIRMED_IDS_KEY, JSON.stringify(["old"]));
  items.push(item("mid", "2026-11-01T12:00:00Z"));
  const view = await mount();
  assert.equal(view.hook().current?.id, "mid", "確かめた old は飛ばす");
  assert.equal(view.hook().total, 2);
  await act(async () => view.hook().skip());
  assert.equal(readAlls, 1);
  assert.deepEqual(new Set(confirmed()), new Set(["old", "mid", "new"]));
  assert.equal(view.hook().open, false);
  await view.unmount();
});
