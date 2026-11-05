// 一覧の読み込み失敗からの再試行の検査(useInfiniteScrollQuery の retry + InfiniteScrollList の onRetry)。
// 実行: pnpm test:infinite-scroll(tsx + node:test。jsdom の上で実際に描画し、「再試行」ボタンを押す)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { InfiniteScrollListProps } from "@/components/Widgets/InfiniteScrollList";
import type { PaginatedResult } from "@/lib/crud";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
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
let InfiniteScrollList: typeof import("@/components/Widgets/InfiniteScrollList").InfiniteScrollList;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useInfiniteScrollQuery } = await import("./useInfiniteScrollQuery"));
  ({ InfiniteScrollList } = await import("@/components/Widgets/InfiniteScrollList"));
});
after(() => dom.window.close());

const LIMIT = 2;
const ROWS = ["a", "b", "c", "d", "e"];

/** 指定した取得回(1 始まり)だけ失敗する fetcher。呼ばれたページを記録する */
const failingFetcher = (failOnCall: number) => {
  const pages: number[] = [];
  const fetcher = async ({ page, limit }: { page: number; limit: number }): Promise<PaginatedResult<string>> => {
    pages.push(page);
    if (pages.length === failOnCall) throw new Error("network");
    return { results: ROWS.slice((page - 1) * limit, page * limit), total: ROWS.length };
  };
  return { fetcher, pages };
};

/** フックと一覧を描き、最新のフックの返り値とコンテナを返す */
const mount = async (fetcher: (p: { page: number; limit: number }) => Promise<PaginatedResult<string>>, withRetry = true) => {
  const latestRef: { current: Query | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  // 最新の返り値は props の report で外へ渡す(描画中に外の変数を直接書き換えない)
  const report = (query: Query) => {
    latestRef.current = query;
  };
  const Probe = ({ report }: { report: (query: Query) => void }) => {
    const query = useInfiniteScrollQuery<string, Record<string, never>>({ fetcher, limit: LIMIT });
    report(query);
    // children は render-prop(関数)なので createElement の第 3 引数ではなく props で渡す
    const props: InfiniteScrollListProps<string> = {
      ...query,
      onRetry: withRetry ? query.retry : undefined,
      children: (items) => createElement("ul", null, items.map((item) => createElement("li", { key: item }, item))),
    };
    return createElement(InfiniteScrollList<string>, props);
  };
  await act(async () => {
    root.render(createElement(Probe, { report }));
  });
  return {
    container,
    query: () => latestRef.current!,
    unmount: () => act(async () => root.unmount()),
  };
};

const rows = (container: HTMLElement) => [...container.querySelectorAll("li")].map((li) => li.textContent);
const retryButton = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === "再試行");

test("1 ページ目の失敗: エラー表示の下に再試行 → 押すと 1 ページ目を取り直して一覧が出る", async () => {
  const { fetcher, pages } = failingFetcher(1);
  const view = await mount(fetcher);
  assert.match(view.container.textContent ?? "", /データの取得に失敗しました/);
  assert.deepEqual(rows(view.container), []);
  const button = retryButton(view.container);
  assert.ok(button, "再試行ボタンが出る");

  await act(async () => button.click());
  assert.deepEqual(pages, [1, 1], "失敗した 1 ページ目を取り直す");
  assert.deepEqual(rows(view.container), ["a", "b"]);
  assert.equal(view.query().error, null);
  assert.equal(view.query().hasMore, true);
  assert.equal(retryButton(view.container), undefined, "成功したら再試行は消える");
  await view.unmount();
});

test("2 ページ目の失敗: 一覧を残して末尾に再試行 → 押すと 2 ページ目を足す", async () => {
  const { fetcher, pages } = failingFetcher(2);
  const view = await mount(fetcher);
  assert.deepEqual(rows(view.container), ["a", "b"]);

  await act(async () => view.query().loadMore());
  assert.deepEqual(rows(view.container), ["a", "b"], "読み込み済みの一覧は消えない");
  assert.match(view.container.textContent ?? "", /続きの読み込みに失敗しました/);
  assert.equal(view.query().hasMore, false, "失敗中は続きを読まない");
  const button = retryButton(view.container);
  assert.ok(button, "末尾に再試行ボタンが出る");

  await act(async () => button.click());
  assert.deepEqual(pages, [1, 2, 2], "失敗した 2 ページ目を取り直す");
  assert.deepEqual(rows(view.container), ["a", "b", "c", "d"]);
  assert.equal(view.query().error, null);
  assert.equal(view.query().hasMore, true);
  await view.unmount();
});

test("onRetry を渡さなければ再試行ボタンは出ない(エラー文だけ)", async () => {
  const first = await mount(failingFetcher(1).fetcher, false);
  assert.match(first.container.textContent ?? "", /データの取得に失敗しました/);
  assert.equal(retryButton(first.container), undefined);
  await first.unmount();

  const second = await mount(failingFetcher(2).fetcher, false);
  await act(async () => second.query().loadMore());
  assert.match(second.container.textContent ?? "", /続きの読み込みに失敗しました/);
  assert.equal(retryButton(second.container), undefined);
  await second.unmount();
});
