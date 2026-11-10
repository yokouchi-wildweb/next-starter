// カーソルのモード(cursorFetcher)の検査: 続きは直前の nextCursor・終端・retry・removeItems・revalidate。
// 実行: pnpm test src/hooks/useInfiniteScrollQuery.cursor.test.tsx(tsx + node:test。jsdom の上でフックを描く)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { CursorPage } from "./cursorPage";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;
// センチネルの Observer は交差を起こさない(続きの読み込みは loadMore を直接呼ぶ)
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

type Query = ReturnType<typeof import("./useInfiniteScrollQuery").useInfiniteScrollQuery<string, Record<string, never>>>;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useInfiniteScrollQuery: typeof import("./useInfiniteScrollQuery").useInfiniteScrollQuery;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useInfiniteScrollQuery } = await import("./useInfiniteScrollQuery"));
});
after(() => dom.window.close());

const LIMIT = 2;

/**
 * 行の値で続きの位置を決める fetcher(cursor = 直前の最後の行)。rows は呼び出しの間に書き換えてよい
 * (先頭に足す・消す)。failOnCall 回目(1 始まり)だけ失敗する。受け取った cursor を記録する
 */
const keysetFetcher = (rows: string[], failOnCall = 0) => {
  const cursors: (string | null)[] = [];
  const fetcher = async ({ cursor, limit }: { cursor: string | null; limit: number }): Promise<CursorPage<string>> => {
    cursors.push(cursor);
    if (cursors.length === failOnCall) throw new Error("network");
    const start = cursor === null ? 0 : rows.indexOf(cursor) + 1;
    const items = rows.slice(start, start + limit);
    const last = items[items.length - 1];
    const nextCursor = start + limit < rows.length && last !== undefined ? last : null;
    return { items, nextCursor };
  };
  return { fetcher, cursors };
};

const mount = async (fetcher: (p: { cursor: string | null; limit: number }) => Promise<CursorPage<string>>) => {
  const latestRef: { current: Query | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const report = (query: Query) => {
    latestRef.current = query;
  };
  const Probe = ({ report }: { report: (query: Query) => void }) => {
    report(useInfiniteScrollQuery<string, Record<string, never>>({ cursorFetcher: fetcher, limit: LIMIT }));
    return null;
  };
  await act(async () => {
    root.render(createElement(Probe, { report }));
  });
  return {
    query: () => latestRef.current!,
    unmount: () => act(async () => root.unmount()),
  };
};

test("続きは直前の nextCursor で取り、nextCursor が null で終わる", async () => {
  const { fetcher, cursors } = keysetFetcher(["a", "b", "c", "d", "e"]);
  const view = await mount(fetcher);
  assert.deepEqual(view.query().items, ["a", "b"]);
  assert.equal(view.query().hasMore, true);

  await act(async () => view.query().loadMore());
  await act(async () => view.query().loadMore());
  assert.deepEqual(view.query().items, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(cursors, [null, "b", "d"]);
  assert.equal(view.query().hasMore, false);
  assert.equal(view.query().total, 5, "total = 読み込み済みの件数");

  await act(async () => view.query().loadMore());
  assert.equal(cursors.length, 3, "終端の後は取らない");
  await view.unmount();
});

test("先頭に行が足されても続きはずれない(offset と違い重複しない)", async () => {
  const rows = ["c", "d", "e", "f"];
  const { fetcher } = keysetFetcher(rows);
  const view = await mount(fetcher);
  rows.unshift("a", "b");
  await act(async () => view.query().loadMore());
  assert.deepEqual(view.query().items, ["c", "d", "e", "f"]);
  await view.unmount();
});

test("removeItems で外しても続きの位置は変わらない", async () => {
  const rows = ["a", "b", "c", "d"];
  const { fetcher, cursors } = keysetFetcher(rows);
  const view = await mount(fetcher);
  await act(async () => view.query().removeItems((item) => item === "a"));
  rows.splice(0, 1);
  assert.deepEqual(view.query().items, ["b"]);
  await act(async () => view.query().loadMore());
  assert.deepEqual(cursors, [null, "b"]);
  assert.deepEqual(view.query().items, ["b", "c", "d"]);
  await view.unmount();
});

test("続きの失敗は位置を進めず、retry は同じ cursor を取り直す", async () => {
  const { fetcher, cursors } = keysetFetcher(["a", "b", "c", "d"], 2);
  const view = await mount(fetcher);
  await act(async () => view.query().loadMore());
  assert.ok(view.query().error);
  assert.deepEqual(view.query().items, ["a", "b"]);
  await act(async () => view.query().retry());
  assert.deepEqual(cursors, [null, "b", "b"]);
  assert.deepEqual(view.query().items, ["a", "b", "c", "d"]);
  assert.equal(view.query().error, null);
  await view.unmount();
});

test("revalidate は先頭(cursor = null)から取り直して置き換える", async () => {
  const rows = ["a", "b", "c", "d"];
  const { fetcher, cursors } = keysetFetcher(rows);
  const view = await mount(fetcher);
  await act(async () => view.query().loadMore());
  rows.unshift("z");
  await act(async () => view.query().revalidate());
  assert.deepEqual(cursors, [null, "b", null]);
  assert.deepEqual(view.query().items, ["z", "a"]);
  assert.equal(view.query().hasMore, true);
  await act(async () => view.query().loadMore());
  assert.deepEqual(cursors.at(-1), "a");
  assert.deepEqual(view.query().items, ["z", "a", "b", "c"]);
  await view.unmount();
});
