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
  /** 取得を開始するページ番号 (デフォルト 1)。 */
  initialPage?: number;
  /** false の場合はフェッチを停止する。 */
  enabled?: boolean;
  /**
   * params の変更などでリセットしたいときの依存配列。
   * 注意: `fetcher` が外部値に依存する場合は、その値も必ず `deps` に含めること。
   * 本フックは `fetcher` の identity 変化自体では再取得せず、`deps` の変化で初期化する。
   */
  deps?: ReadonlyArray<unknown>;
  /**
   * SSR 等で事前取得済みのデータ。初回マウント時および `deps` 変更時に
   * このデータで初期化し、該当分の API 取得をスキップする。
   *
   * 制約:
   * - `limit` は本フックに渡す値と同じ値で取得していること。
   * - `items.length` が `limit` の整数倍でなくてもよい。端数の場合は
   *   「直近バッチが limit 未満」= 終端とみなされ、以降のロードは発火しない。
   * - `items.length >= limit` かつ倍数であれば複数ページ相当の事前取得も許容する
   *   (例: limit=100 / items.length=200 は pages=1..2 を事前取得済みとして扱う)。
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
  /** 次に `loadMore` / `retry` で取得されるページ番号。 */
  nextPage: number;
  loadMore: () => void;
  /** エラー復帰用: 直近失敗したページを再取得する。`hasMore=false` でも動作する。 */
  retry: () => void;
  /** 全状態を初期状態に戻し、`initialPage` から再取得する。 */
  reset: () => void;
  sentinelRef: (node: HTMLElement | null) => void;
};

// ============================================================================
// Pure helpers (export: ユニットテスト容易化 & 呼び出し側での自力計算補助)
// ============================================================================

/**
 * initialData から「既に fetch 済みの最終ページ番号」を算出する。
 * items が空の場合は `initialPage - 1` (= まだ何も fetch していない状態) を返す。
 *
 * @example
 * computeLastFetchedPage(100, 100, 1) // => 1  (ちょうど 1 ページ分)
 * computeLastFetchedPage(150, 100, 1) // => 2  (2 ページ目の端数を含む)
 * computeLastFetchedPage(0, 100, 1)   // => 0  (未取得)
 * computeLastFetchedPage(100, 100, 5) // => 5  (page 5 から開始して 1 ページ分)
 */
export function computeLastFetchedPage(
  itemsLength: number,
  limit: number,
  initialPage: number,
): number {
  if (itemsLength <= 0) return initialPage - 1;
  if (limit <= 0) return initialPage - 1;
  return initialPage - 1 + Math.ceil(itemsLength / limit);
}

/**
 * 直近バッチのサイズを算出する。limit の整数倍なら `limit`、端数があればその端数。
 * items が空なら 0。
 */
export function computeLastBatchSize(itemsLength: number, limit: number): number {
  if (itemsLength <= 0) return 0;
  if (limit <= 0) return 0;
  const remainder = itemsLength % limit;
  return remainder === 0 ? limit : remainder;
}

/**
 * `hasMore` を多要素で算出する。total のみに依存すると upstream の total が
 * 不正確だった場合に無限ループを誘発するため、直近バッチサイズも併せて判定する。
 *
 * 終端条件 (いずれかを満たせば false):
 * - items.length >= total
 * - 直近バッチが 0 件 (= サーバが「もう無い」と返した)
 * - 直近バッチが limit 未満 (= 末尾の部分ページ)
 *
 * `lastBatchSize === null` は "まだ一度も fetch していない" を表す (初期状態)。
 */
export function computeHasMore(
  itemsLength: number,
  total: number,
  lastBatchSize: number | null,
  limit: number,
): boolean {
  if (itemsLength >= total) return false;
  if (lastBatchSize !== null && lastBatchSize <= 0) return false;
  if (lastBatchSize !== null && lastBatchSize < limit) return false;
  return true;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * IntersectionObserver を使って末尾で自動的に `loadMore` を呼び出しながら
 * ページング API からチャンク単位でデータを取得するためのフック。
 *
 * ### セマンティクス
 * - 初回マウント時、`initialData` が無ければ `initialPage` を取得する。
 * - `initialData` があればそのデータで初期化し、該当分の fetch はスキップ。
 *   `loadMore` 時は `lastFetchedPage + 1` を取得する。
 * - `deps` 変化で全状態リセット → `initialData` があれば再初期化、無ければ再フェッチ。
 * - `fetcher` identity 変化だけでは再取得しない。`fetcher` が外部値に依存する場合は
 *   `deps` に同じキーを含めること (現行の呼び出しパターンはすべてこの契約に従っている)。
 *
 * ### 堅牢性
 * - `hasMore` は「items < total」に加えて「直近バッチが limit 未満/0 件なら false」。
 *   upstream の `total` が不正確でも無限ループしない。
 * - `loadMore` / `sentinelRef` の identity を `enabled`/`isLoading`/`hasMore` から
 *   切り離し、guard を ref 経由で読む。Observer の無駄な再アタッチを抑制。
 * - 競合する fetch は `requestIdRef` で破棄 (最新のみ反映)。
 * - `reset` / `deps` 変化時は in-flight リクエストを強制無効化する。
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
  const initialItems = initialData?.items ?? [];
  const initialTotal = initialData?.total ?? 0;
  const initialLastFetchedPage = hasInitialData
    ? computeLastFetchedPage(initialItems.length, limit, initialPage)
    : initialPage - 1;
  const initialLastBatchSize = hasInitialData
    ? computeLastBatchSize(initialItems.length, limit)
    : null;
  const initialHasMore = hasInitialData
    ? computeHasMore(initialItems.length, initialTotal, initialLastBatchSize, limit)
    : true;

  // 公開 state
  const [items, setItems] = useState<TItem[]>(initialItems);
  const [total, setTotal] = useState<number>(initialTotal);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);

  // fetch トリガ: tick が変化すると useEffect が fetchPage(pendingPageRef) を走らせる。
  // state + ref の組合せにする理由: setState(同値) では useEffect が再発火せず
  // 同ページの retry を表現できないため、tick を使う。
  const [fetchTick, setFetchTick] = useState<number>(0);
  const pendingPageRef = useRef<number>(
    hasInitialData ? initialLastFetchedPage + 1 : initialPage,
  );
  const skipNextFetchRef = useRef<boolean>(hasInitialData);

  // 内部スナップショット ref
  const itemsRef = useRef<TItem[]>(initialItems);
  const lastFetchedPageRef = useRef<number>(initialLastFetchedPage);
  const requestIdRef = useRef<number>(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const depsInitializedRef = useRef<boolean>(false);
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;

  // guard 用 ref (callback identity を安定化させるため state 値を ref 経由で読む)
  const enabledRef = useRef<boolean>(enabled);
  const isLoadingRef = useRef<boolean>(false);
  const hasMoreRef = useRef<boolean>(initialHasMore);
  enabledRef.current = enabled;

  // option 系を ref 化して fetchPage の identity を固定する
  const fetcherRef = useRef(fetcher);
  const paramsRef = useRef(params);
  const limitRef = useRef(limit);
  const initialPageRef = useRef(initialPage);
  fetcherRef.current = fetcher;
  paramsRef.current = params;
  limitRef.current = limit;
  initialPageRef.current = initialPage;

  const fetchPage = useCallback(async (pageToFetch: number) => {
    if (!enabledRef.current) return;

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    isLoadingRef.current = true;
    setError(null);

    try {
      const currentLimit = limitRef.current;
      const result = await fetcherRef.current({
        ...(paramsRef.current as TParams),
        page: pageToFetch,
        limit: currentLimit,
      });

      if (currentRequestId !== requestIdRef.current) return;

      const baseItems = pageToFetch === initialPageRef.current ? [] : itemsRef.current;
      const nextItems = [...baseItems, ...result.results];
      const batchSize = result.results.length;
      const nextHasMore = computeHasMore(
        nextItems.length,
        result.total,
        batchSize,
        currentLimit,
      );

      itemsRef.current = nextItems;
      lastFetchedPageRef.current = pageToFetch;
      hasMoreRef.current = nextHasMore;

      setItems(nextItems);
      setTotal(result.total);
      setHasMore(nextHasMore);
      setError(null);
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      setError(err);
      setHasMore(false);
      hasMoreRef.current = false;
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, []);

  // fetch 実行トリガ。mount / loadMore / retry / reset からここに集約される。
  useEffect(() => {
    if (!enabled) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    fetchPage(pendingPageRef.current);
  }, [enabled, fetchTick, fetchPage]);

  const triggerFetch = useCallback((pageToFetch: number) => {
    pendingPageRef.current = pageToFetch;
    skipNextFetchRef.current = false;
    setFetchTick((tick) => tick + 1);
  }, []);

  const loadMore = useCallback(() => {
    if (!enabledRef.current || isLoadingRef.current || !hasMoreRef.current) return;
    triggerFetch(lastFetchedPageRef.current + 1);
  }, [triggerFetch]);

  const retry = useCallback(() => {
    if (!enabledRef.current || isLoadingRef.current) return;
    triggerFetch(lastFetchedPageRef.current + 1);
  }, [triggerFetch]);

  const applyReset = useCallback((nextInitialData?: { items: TItem[]; total: number }) => {
    const hasInit = nextInitialData !== undefined;
    const nextItems = nextInitialData?.items ?? [];
    const nextTotalValue = nextInitialData?.total ?? 0;
    const nextLastFetched = hasInit
      ? computeLastFetchedPage(nextItems.length, limitRef.current, initialPageRef.current)
      : initialPageRef.current - 1;
    const nextLastBatchSize = hasInit
      ? computeLastBatchSize(nextItems.length, limitRef.current)
      : null;
    const nextHasMore = hasInit
      ? computeHasMore(nextItems.length, nextTotalValue, nextLastBatchSize, limitRef.current)
      : true;

    // in-flight 無効化
    requestIdRef.current += 1;

    itemsRef.current = nextItems;
    lastFetchedPageRef.current = nextLastFetched;
    hasMoreRef.current = nextHasMore;
    isLoadingRef.current = false;

    setItems(nextItems);
    setTotal(nextTotalValue);
    setHasMore(nextHasMore);
    setError(null);
    setIsLoading(false);

    pendingPageRef.current = hasInit ? nextLastFetched + 1 : initialPageRef.current;
    skipNextFetchRef.current = hasInit;
    setFetchTick((tick) => tick + 1);
  }, []);

  const reset = useCallback(() => {
    applyReset(undefined);
  }, [applyReset]);

  // deps 変化での再初期化
  useEffect(() => {
    if (!deps || deps.length === 0) return;
    if (!depsInitializedRef.current) {
      depsInitializedRef.current = true;
      return;
    }
    applyReset(initialDataRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps ?? []);

  // アンマウント時に Observer を掃除する
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node) return;

      observerRef.current = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        // guard は ref 経由で最新値を読む (Observer 自体は再生成せずに済む)
        if (!enabledRef.current || isLoadingRef.current || !hasMoreRef.current) return;
        triggerFetch(lastFetchedPageRef.current + 1);
      }, observerOptions);

      observerRef.current.observe(node);
    },
    [observerOptions, triggerFetch],
  );

  return {
    items,
    total,
    isLoading,
    error,
    hasMore,
    nextPage: lastFetchedPageRef.current + 1,
    loadMore,
    retry,
    reset,
    sentinelRef,
  };
}
