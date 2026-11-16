// InfiniteScrollList の既定の出力を比べる場合の一覧(render テストと期待値の記録で同じ物を使う)
import { createElement, type ReactElement } from "react";

import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

const noop = () => {};
const list = (items: string[]) => createElement("ul", null, ...items.map((i) => createElement("li", { key: i }, i)));
const base = { items: [] as string[], isInitialLoading: false, isFetchingMore: false, hasMore: false, sentinelRef: noop, children: list };

/** 新しい指定を渡さない場合(既定の出力は変えない) */
export const defaultCases: Record<string, ReactElement> = {
  initialLoading: createElement(InfiniteScrollList<string>, { ...base, isInitialLoading: true }),
  initialError: createElement(InfiniteScrollList<string>, { ...base, error: new Error("x") }),
  initialErrorRetry: createElement(InfiniteScrollList<string>, { ...base, error: new Error("x"), onRetry: noop }),
  empty: createElement(InfiniteScrollList<string>, { ...base }),
  emptyCustom: createElement(InfiniteScrollList<string>, { ...base, emptyNode: createElement("p", null, "なし") }),
  idleMore: createElement(InfiniteScrollList<string>, { ...base, items: ["a", "b"], hasMore: true }),
  fetchingMore: createElement(InfiniteScrollList<string>, { ...base, items: ["a", "b"], hasMore: true, isFetchingMore: true }),
  moreError: createElement(InfiniteScrollList<string>, { ...base, items: ["a"], error: new Error("x"), onRetry: noop }),
  completed: createElement(InfiniteScrollList<string>, { ...base, items: ["a"] }),
  completedText: createElement(InfiniteScrollList<string>, { ...base, items: ["a"], completedText: "おわり" }),
  completedHidden: createElement(InfiniteScrollList<string>, { ...base, items: ["a"], hideCompletedNotice: true }),
};
