// InboxList と流れの hook useInboxList の検査(jsdom の上で描く。useInboxList の下の hook と toast は偽物 = 入れ物 + useInboxList を本物で通す)。
// - 行・未読の印・0 件の文言
// - 未読の行を押すと既読にして一覧の印を変える(updateItems)。既読の行は呼ばない
// - 「すべて既読にする」は全部既読にして未読の行の印を変え、知らせる
// 実行: pnpm test src/features/core/messaging/components/InboxList/index.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
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

type Item = { id: string; title: string | null; body: string; link: null; image: null; metadata: null; publishedAt: string; read: boolean };
const item = (id: string, read: boolean): Item => ({ id, title: `題 ${id}`, body: `本文 ${id}`, link: null, image: null, metadata: null, publishedAt: "2026-11-01T00:00:00.000Z", read });

let items: Item[] = [];
const updates: { matched: string[] }[] = [];
const reads: string[] = [];
let readAlls = 0;

mock.module("@/features/core/messaging/hooks/useInboxItems", {
  namedExports: {
    useInboxItems: () => ({
      items,
      isInitialLoading: false,
      isFetchingMore: false,
      hasMore: false,
      error: null,
      sentinelRef: () => {},
      retry: () => {},
      updateItems: (predicate: (row: Item) => boolean) => {
        updates.push({ matched: items.filter(predicate).map((row) => row.id) });
      },
    }),
  },
});
mock.module("@/features/core/messaging/hooks/useInboxUnreadCount", {
  namedExports: { useInboxUnreadCount: () => ({ count: items.filter((row) => !row.read).length }) },
});
mock.module("@/features/core/messaging/hooks/useMarkInboxItemRead", {
  namedExports: {
    useMarkInboxItemRead: () => ({
      markRead: async (id: string) => {
        reads.push(id);
      },
    }),
  },
});
mock.module("@/features/core/messaging/hooks/useMarkAllInboxRead", {
  namedExports: {
    useMarkAllInboxRead: () => ({
      markAllRead: async () => {
        readAlls += 1;
      },
    }),
  },
});
// Modal は Radix(portal・focus)を jsdom で動かさない偽物: 開いている間だけ題と中身を描く
mock.module("@/components/Overlays/Modal", {
  defaultExport: ({ open, title, children }: { open: boolean; title?: unknown; children?: unknown }) =>
    open ? createElement("section", { "data-testid": "modal" }, title as never, children as never) : null,
});
const toasts: string[] = [];
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: (message: string, kind: string) => void toasts.push(`${kind}:${message}`) }) } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let InboxList: typeof import("./index").InboxList;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ InboxList } = await import("./index"));
});
after(() => dom.window.close());
beforeEach(() => {
  updates.length = 0;
  reads.length = 0;
  readAlls = 0;
});

const mount = async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(InboxList)));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(text));

test("行と未読の印を描き、0 件は文言を出す", async () => {
  items = [item("a", false), item("b", true)];
  const view = await mount();
  const text = view.container.textContent ?? "";
  assert.match(text, /題 a/);
  assert.match(text, /題 b/);
  assert.equal(text.match(/未読/g)?.length, 1, "未読の印は未読の行だけ");
  await view.unmount();

  items = [];
  const empty = await mount();
  assert.match(empty.container.textContent ?? "", /お知らせはありません/);
  assert.ok((button(empty.container, "すべて既読にする") as HTMLButtonElement).disabled, "未読 0 は押せない");
  await empty.unmount();
});

test("未読の行を押すと既読にして印を変える。既読の行は API を呼ばない", async () => {
  items = [item("a", false), item("b", true)];
  const view = await mount();
  await act(async () => button(view.container, "題 a")!.click());
  assert.deepEqual(reads, ["a"]);
  assert.deepEqual(updates, [{ matched: ["a"] }]);
  assert.match(view.container.querySelector("[data-testid=modal]")?.textContent ?? "", /本文 a/, "詳細を開く");

  await act(async () => button(view.container, "題 b")!.click());
  assert.deepEqual(reads, ["a"], "既読の行は呼ばない");
  await view.unmount();
});

test("すべて既読にする → API を呼び、未読の行の印を変える", async () => {
  items = [item("a", false), item("b", true), item("c", false)];
  const view = await mount();
  await act(async () => button(view.container, "すべて既読にする")!.click());
  assert.equal(readAlls, 1);
  assert.deepEqual(updates, [{ matched: ["a", "c"] }]);
  assert.deepEqual(toasts.at(-1), "success:すべて既読にしました");
  await view.unmount();
});
