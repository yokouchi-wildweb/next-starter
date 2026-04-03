import { useCallback, useEffect, useRef, useState } from "react";

import type { PaginatedResult } from "@/lib/crud";

type FetcherParams<TParams extends Record<string, unknown>> =
  { page: number; limit: number } & TParams;

type InfiniteFetcher<TItem, TParams extends Record<string, unknown>> = (
  params: FetcherParams<TParams>,
) => Promise<PaginatedResult<TItem>>;

type UseInfiniteScrollQueryOptions<TItem, TParams extends Record<string, unknown>> = {
  fetcher: InfiniteFetcher<TItem, TParams>;
  params?: TParams;
  /** 1 ページあたりに取得する件数。 */
  limit?: number;
  /** 取得を開始するページ番号。 */
  initialPage?: number;
  /** false の場合はフェッチを停止する。 */
  enabled?: boolean;
  /** params の変更などでリセットしたいときの依存配列。 */
  deps?: ReadonlyArray<unknown>;
  /**
   * SSR 等で事前取得済みのデータ。初回マウント時および deps 変更時に
   * このデータで初期化し、API 取得をスキップする。
   * limit は本フックに渡す値と同じ値で取得すること。
   */
  initialData?: { items: TItem[]; total: number };
  /** IntersectionObserver のオプション。 */
  observerOptions?: IntersectionObserverInit;
};

type UseInfiniteScrollQueryResult<TItem> = {
  items: TItem[];
  total: number;
  isLoading: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  sentinelRef: (node: HTMLElement | null) => void;
};

/**
 * IntersectionObserver を使って末尾で自動的に `loadMore` を呼び出しながら
 * ページング API からチャンク単位でデータを取得するためのフック。
 */
export function useInfiniteScrollQuery<
  TItem,
  TParams extends Record<string, unknown> = Record<string, never>,
>(options: UseInfiniteScrollQueryOptions<TItem, TParams>): UseInfiniteScrollQueryResult<TItem> {
  const {
    fetcher,
    params,
    limit = 20,
    initialPage = 1,
    enabled = true,
    deps,
    initialData,
    observerOptions,
  } = options;

  const hasInitialData = initialData !== undefined;
  const initialStartPage = hasInitialData
    ? Math.ceil(initialData.items.length / limit) + 1
    : initialPage;

  const [page, setPage] = useState(initialStartPage);
  const [items, setItems] = useState<TItem[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(
    hasInitialData ? initialData.items.length < initialData.total : true,
  );
  const [resetCounter, setResetCounter] = useState(0);

  const itemsRef = useRef<TItem[]>(initialData?.items ?? []);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const latestPageRef = useRef(initialStartPage);
  const requestIdRef = useRef(0);
  const depsInitialized = useRef(false);
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;
  /** initialData による初期化直後、fetchPage useEffect の発火をスキップするフラグ */
  const initialFetchSkipped = useRef(hasInitialData);

  const fetchPage = useCallback(
    async (pageToFetch: number) => {
      if (!enabled) return;

      setIsLoading(true);
      setError(null);
      const currentRequestId = ++requestIdRef.current;

      try {
        const result = await fetcher({
          ...(params as TParams),
          page: pageToFetch,
          limit,
        });

        if (currentRequestId !== requestIdRef.current) return;

        const baseItems = pageToFetch === initialPage ? [] : itemsRef.current;
        const nextItems = [...baseItems, ...result.results];

        itemsRef.current = nextItems;
        latestPageRef.current = pageToFetch;
        setItems(nextItems);
        setTotal(result.total);
        setHasMore(nextItems.length < result.total);
        setError(null);
      } catch (err) {
        if (currentRequestId !== requestIdRef.current) return;
        setError(err);
        setHasMore(false);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [enabled, fetcher, initialPage, limit, params],
  );

  useEffect(() => {
    if (!enabled) return;
    if (initialFetchSkipped.current) {
      initialFetchSkipped.current = false;
      return;
    }
    fetchPage(page);
  }, [enabled, fetchPage, page, resetCounter]);

  const loadMore = useCallback(() => {
    if (!enabled || isLoading || !hasMore) return;
    setPage((prev) => prev + 1);
  }, [enabled, hasMore, isLoading]);

  const reset = useCallback(() => {
    itemsRef.current = [];
    latestPageRef.current = initialPage;
    setItems([]);
    setTotal(0);
    setHasMore(true);
    setError(null);
    setPage(initialPage);
    setResetCounter((count) => count + 1);
  }, [initialPage]);

  const reinitializeWithData = useCallback(
    (data: { items: TItem[]; total: number }) => {
      const nextPage = Math.ceil(data.items.length / limit) + 1;
      itemsRef.current = data.items;
      latestPageRef.current = nextPage;
      initialFetchSkipped.current = true;
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.items.length < data.total);
      setError(null);
      setPage(nextPage);
      setResetCounter((count) => count + 1);
    },
    [limit],
  );

  useEffect(() => {
    if (!deps || deps.length === 0) return;
    if (!depsInitialized.current) {
      depsInitialized.current = true;
      return;
    }
    const currentInitialData = initialDataRef.current;
    if (currentInitialData !== undefined) {
      reinitializeWithData(currentInitialData);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps ?? []);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || !enabled) return;

      observerRef.current = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        loadMore();
      }, observerOptions);

      observerRef.current.observe(node);
    },
    [enabled, loadMore, observerOptions],
  );

  return {
    items,
    total,
    isLoading,
    error,
    hasMore,
    loadMore,
    reset,
    sentinelRef,
  };
}
