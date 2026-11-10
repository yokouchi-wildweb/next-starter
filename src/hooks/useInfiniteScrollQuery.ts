import { useCallback, useEffect, useRef, useState } from "react";

import type { PaginatedResult } from "@/lib/crud";

import type { CursorPage } from "./cursorPage";

export type { CursorPage } from "./cursorPage";

type FetcherParams<TParams extends Record<string, unknown>> =
  { page: number; limit: number } & TParams;

type InfiniteFetcher<TItem, TParams extends Record<string, unknown>> = (
  params: FetcherParams<TParams>,
) => Promise<PaginatedResult<TItem>>;

type CursorFetcherParams<TParams extends Record<string, unknown>> =
  { cursor: string | null; limit: number } & TParams;

/** カーソルのモードの取得関数。cursor = null は先頭から(初回・revalidate・reset) */
type CursorFetcher<TItem, TParams extends Record<string, unknown>> = (
  params: CursorFetcherParams<TParams>,
) => Promise<CursorPage<TItem>>;

/** offset のモード(page / limit + total)。既定 */
type OffsetModeOptions<TItem, TParams extends Record<string, unknown>> = {
  fetcher: InfiniteFetcher<TItem, TParams>;
  cursorFetcher?: never;
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
};

/**
 * カーソルのモード(続きの位置 nextCursor で取る。総数なし)。増え続ける一覧(お知らせ・ログ・履歴)はこちら。
 * - 続きは直前の応答の nextCursor で取る。nextCursor が null か 0 件の応答で終端
 * - `total` は読み込み済みの件数(サーバーの総数ではない)
 * - `removeItems` で外しても続きの位置はずれない(カーソルは行の値で決まる)。補正も取り直しもしない
 * - `revalidate` / `reset` / `deps` 変化は先頭(cursor = null)から取り直す
 * - モードは mount 時に決まる(途中で fetcher と cursorFetcher を入れ替えない)
 */
type CursorModeOptions<TItem, TParams extends Record<string, unknown>> = {
  cursorFetcher: CursorFetcher<TItem, TParams>;
  fetcher?: never;
  /** SSR 等で事前取得済みの 1 回分(先頭から)。`limit` は本フックに渡す値と同じ値で取得していること */
  initialData?: CursorPage<TItem>;
};

type CommonOptions<TParams extends Record<string, unknown>> = {
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
   * IntersectionObserver のオプション。
   * センチネルの attach 時にのみ参照される (identity 変化では Observer を再生成しない)。
   */
  observerOptions?: IntersectionObserverInit;
  /**
   * タブに戻ったとき (visibilitychange で visible / window focus) に `revalidate()` する。
   * 既定 false (従来どおり再取得しない)。items は維持したまま 1 ページ目を取り直す
   * (`revalidate` と同じ: 複数ページ読み込み済みなら 1 ページ目だけに戻り、以降は loadMore で取り直す)。
   * 連続発火は 5 秒に 1 回まで。初回取得の完了前・取得中・`enabled=false` の間は何もしない。
   */
  revalidateOnFocus?: boolean;
};

type UseInfiniteScrollQueryOptions<TItem, TParams extends Record<string, unknown>> =
  CommonOptions<TParams> &
  (OffsetModeOptions<TItem, TParams> | CursorModeOptions<TItem, TParams>);

/** revalidateOnFocus の最小間隔 (SWR の focusThrottleInterval 既定と同じ) */
const FOCUS_REVALIDATE_THROTTLE_MS = 5000;

type UseInfiniteScrollQueryResult<TItem> = {
  items: TItem[];
  /** offset のモード = サーバーの総数 (removeItems で減算) | カーソルのモード = 読み込み済みの件数 */
  total: number;
  /**
   * いずれかの fetch が in-flight (初回 or 追加)。
   * 「初回」と「追加」を区別したい場合は `isInitialLoading` / `isFetchingMore` を使うこと。
   * 呼び出し側で `if (isLoading) return <FullScreenLoader />` のように early return すると、
   * 追加ロード時にも全画面ローダーで覆われて既存のリストが消えるアンチパターンになるため非推奨。
   */
  isLoading: boolean;
  /**
   * 初回ロード中 (まだ items が空でこれから埋まる、または reset 直後)。
   * 全画面スケルトン / 全画面ローダーの出し分け用。
   */
  isInitialLoading: boolean;
  /**
   * センチネル発火による追加ロード中 (既に items が表示されている)。
   * リスト末尾のインラインインジケータ表示用。
   */
  isFetchingMore: boolean;
  error: unknown;
  hasMore: boolean;
  /** 次に `loadMore` / `retry` で取得されるページ番号。 */
  nextPage: number;
  loadMore: () => void;
  /** エラー復帰用: 直近失敗したページを再取得する。`hasMore=false` でも動作する。 */
  retry: () => void;
  /**
   * 全状態を初期状態に戻し、`initialPage` から再取得する。
   * items / hasFetchedOnce もリセットされるため、UI 側は「初回ロード中」表示に戻る。
   * アクション完了後の最新化用途では `revalidate()` を使うこと。
   */
  reset: () => void;
  /**
   * items を維持したまま 1 ページ目から再フェッチして完了時に上書きする。
   * アクション完了後の最新化など、リスト表示を中断させたくないケース用。
   */
  revalidate: () => void;
  /**
   * predicate に該当する items を updater で書き換える (オプティミスティック更新)。
   * total / hasMore / hasFetchedOnce は変更しない。
   * サーバーが処理完了 ID を返すアクション (status 変更等) を即時 UI 反映する用途。
   */
  updateItems: (
    predicate: (item: TItem) => boolean,
    updater: (item: TItem) => TItem,
  ) => void;
  /**
   * predicate に該当する items をリストから削除する (オプティミスティック更新)。
   * total は連動して減算される。hasMore は変更しない。
   * フィルタ済みリスト (例: status="pending" タブ) で別 status に遷移した item を即時除去する用途。
   *
   * サーバー側でも同じ行が一覧から外れた (削除・status 変更) ことを前提にする。
   * 外れた件数だけサーバーのページ境界が前にずれるため、次の `loadMore` は
   * ずれた分を含むページから取り直し、取得済みの範囲を切り落として末尾に足す
   * (`computeNextFetchPosition`)。サーバーに残る行をクライアントだけで隠す用途に使うと、
   * その行が次の読み込みで再び現れる。
   * カーソルのモードは位置がずれないので補正せず、続きは nextCursor のまま取る
   * (サーバーに残る行を隠しても、取得済みの範囲の行は再び現れない)。
   */
  removeItems: (predicate: (item: TItem) => boolean) => void;
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

/**
 * 次に取得する位置 (ページ番号と、そのページの先頭から捨てる件数) を算出する。
 *
 * `removeItems` で k 件を外すとサーバー側の行が k 件前に詰まり、
 * `lastFetchedPage + 1` をそのまま取ると k 件が読み飛ばされる。
 * 取得済み範囲の次の行 (絶対位置 `lastFetchedPage * limit - removedCount`) を含むページを取り、
 * その手前の `skip` 件 (= 取得済み) を捨てる。
 *
 * @example
 * computeNextFetchPosition(2, 20, 0)  // => { page: 3, skip: 0 }
 * computeNextFetchPosition(2, 20, 3)  // => { page: 2, skip: 17 }
 * computeNextFetchPosition(2, 20, 20) // => { page: 2, skip: 0 }
 * computeNextFetchPosition(2, 20, 25) // => { page: 1, skip: 15 }
 */
export function computeNextFetchPosition(
  lastFetchedPage: number,
  limit: number,
  removedCount: number,
): { page: number; skip: number } {
  if (limit <= 0 || removedCount <= 0) {
    return { page: lastFetchedPage + 1, skip: 0 };
  }
  const nextIndex = Math.max(0, lastFetchedPage * limit - removedCount);
  return { page: Math.floor(nextIndex / limit) + 1, skip: nextIndex % limit };
}

/** 初期化 (mount・reset・deps 変化) の状態。両モード共通の形 */
export type InfiniteScrollInitialState<TItem> = {
  hasInitialData: boolean;
  items: TItem[];
  total: number;
  lastFetchedPage: number;
  hasMore: boolean;
  /** カーソルのモードの続きの位置 (offset のモードは常に null) */
  nextCursor: string | null;
};

/**
 * initialData から初期化の状態を算出する。
 * - offset: items と total から取得済みのページ数・終端を計算する (従来どおり)
 * - cursor: initialData = 先頭の 1 回分。取得済みは initialPage、終端は nextCursor が null か 0 件
 */
export function computeInitialState<TItem>(
  initialData: { items: TItem[]; total: number } | CursorPage<TItem> | undefined,
  isCursorMode: boolean,
  limit: number,
  initialPage: number,
): InfiniteScrollInitialState<TItem> {
  if (initialData === undefined) {
    return {
      hasInitialData: false,
      items: [],
      total: 0,
      lastFetchedPage: initialPage - 1,
      hasMore: true,
      nextCursor: null,
    };
  }
  const items = initialData.items;
  if (isCursorMode) {
    const nextCursor = "nextCursor" in initialData ? initialData.nextCursor : null;
    return {
      hasInitialData: true,
      items,
      total: items.length,
      lastFetchedPage: initialPage,
      hasMore: computeCursorHasMore(nextCursor, items.length),
      nextCursor,
    };
  }
  const total = "total" in initialData ? initialData.total : items.length;
  return {
    hasInitialData: true,
    items,
    total,
    lastFetchedPage: computeLastFetchedPage(items.length, limit, initialPage),
    hasMore: computeHasMore(items.length, total, computeLastBatchSize(items.length, limit), limit),
    nextCursor: null,
  };
}

/** カーソルのモードの終端判定: nextCursor が null、または 0 件の応答 (サーバーの不具合でも無限に取らない) */
export function computeCursorHasMore(nextCursor: string | null, batchSize: number): boolean {
  return nextCursor !== null && batchSize > 0;
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
 * ### モード
 * - offset (`fetcher`、既定): page / limit で取り、サーバーの total で終端を決める
 * - cursor (`cursorFetcher`): 直前の応答の nextCursor で続きを取る。総数を数えない。
 *   増え続ける一覧 (お知らせ・ログ・履歴) はこちら (`CursorModeOptions` の説明)
 *
 * ### 堅牢性
 * - `hasMore` は「items < total」に加えて「直近バッチが limit 未満/0 件なら false」。
 *   upstream の `total` が不正確でも無限ループしない。
 * - `loadMore` / `sentinelRef` の identity を `enabled`/`isLoading`/`hasMore`/
 *   `observerOptions` から切り離し、guard を ref 経由で読む。Observer の無駄な再アタッチを抑制。
 * - フェッチ完了後・`enabled` 復帰後にセンチネルが可視のままの場合は re-observe で
 *   交差状態を再評価し、ビューポートが埋まるまでページを連鎖ロードする
 *   (IntersectionObserver は交差の遷移でしか発火しないため、縦長ビューポート ×
 *   小さい limit で初期ページが画面を埋めきれないとストールする問題への対策)。
 * - 競合する fetch は `requestIdRef` で破棄 (最新のみ反映)。
 * - `reset` / `deps` 変化時は in-flight リクエストを強制無効化する。
 */
export function useInfiniteScrollQuery<
  TItem,
  TParams extends Record<string, unknown> = Record<string, never>,
>(options: UseInfiniteScrollQueryOptions<TItem, TParams>): UseInfiniteScrollQueryResult<TItem> {
  const {
    params,
    limit = 20,
    initialPage = 1,
    enabled = true,
    deps,
    observerOptions,
    revalidateOnFocus = false,
  } = options;
  // モードは mount 時に決まる(途中の入れ替えは扱わない)
  const isCursorModeRef = useRef<boolean>(options.cursorFetcher !== undefined);
  const isCursorMode = isCursorModeRef.current;
  const initialData = options.initialData;

  const initialState = computeInitialState(initialData, isCursorMode, limit, initialPage);
  const hasInitialData = initialState.hasInitialData;
  const initialItems = initialState.items;
  const initialTotal = initialState.total;
  const initialLastFetchedPage = initialState.lastFetchedPage;
  const initialHasMore = initialState.hasMore;

  // 公開 state
  const [items, setItems] = useState<TItem[]>(initialItems);
  const [total, setTotal] = useState<number>(initialTotal);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  // 初回 fetch が完了したか (成功/失敗を問わない)。initialData があれば最初から true。
  // isLoading だけでは mount 直後の useEffect 発火前 1 フレームをカバーできず、
  // 上位コンポーネントが「fetch 前の空 items」を「結果なし」と誤判定するため必要。
  const [hasFetchedOnce, setHasFetchedOnce] = useState<boolean>(hasInitialData);

  // fetch トリガ: tick が変化すると useEffect が fetchPage(pendingPageRef) を走らせる。
  // state + ref の組合せにする理由: setState(同値) では useEffect が再発火せず
  // 同ページの retry を表現できないため、tick を使う。
  const [fetchTick, setFetchTick] = useState<number>(0);
  const pendingPageRef = useRef<number>(
    hasInitialData ? initialLastFetchedPage + 1 : initialPage,
  );
  // pendingPageRef の先頭から捨てる件数 (removeItems で詰まった分の取得済み行)
  const pendingSkipRef = useRef<number>(0);
  const skipNextFetchRef = useRef<boolean>(hasInitialData);

  // 内部スナップショット ref
  const itemsRef = useRef<TItem[]>(initialItems);
  const lastFetchedPageRef = useRef<number>(initialLastFetchedPage);
  // 直近の取得以降に removeItems で外した件数 (次の取得位置の補正用)
  const removedSinceFetchRef = useRef<number>(0);
  const requestIdRef = useRef<number>(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = useRef<HTMLElement | null>(null);
  const depsInitializedRef = useRef<boolean>(false);
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;
  // カーソルのモードの続きの位置 (直前に成功した取得の nextCursor)
  const nextCursorRef = useRef<string | null>(initialState.nextCursor);

  // guard 用 ref (callback identity を安定化させるため state 値を ref 経由で読む)
  const enabledRef = useRef<boolean>(enabled);
  const isLoadingRef = useRef<boolean>(false);
  const hasMoreRef = useRef<boolean>(initialHasMore);
  enabledRef.current = enabled;

  // option 系を ref 化して fetchPage の identity を固定する
  const fetcherRef = useRef(options.fetcher);
  const cursorFetcherRef = useRef(options.cursorFetcher);
  const paramsRef = useRef(params);
  const limitRef = useRef(limit);
  const initialPageRef = useRef(initialPage);
  const observerOptionsRef = useRef(observerOptions);
  fetcherRef.current = options.fetcher;
  cursorFetcherRef.current = options.cursorFetcher;
  paramsRef.current = params;
  limitRef.current = limit;
  initialPageRef.current = initialPage;
  observerOptionsRef.current = observerOptions;

  const fetchPage = useCallback(async (pageToFetch: number, skip: number) => {
    if (!enabledRef.current) return;

    const currentRequestId = ++requestIdRef.current;
    // この取得が補正に使った削除件数。取得中に外された分は次の取得に持ち越す
    const removedAtStart = removedSinceFetchRef.current;
    setIsLoading(true);
    isLoadingRef.current = true;
    setError(null);

    try {
      const currentLimit = limitRef.current;

      if (isCursorModeRef.current) {
        // 先頭 (初回・revalidate・reset・初回の retry) は cursor = null で取って置き換える。
        // 続きは直前に成功した取得の nextCursor (失敗した取得は位置を進めないので retry は同じ位置を取る)
        const replaces = pageToFetch === initialPageRef.current;
        const page = await cursorFetcherRef.current!({
          ...(paramsRef.current as TParams),
          cursor: replaces ? null : nextCursorRef.current,
          limit: currentLimit,
        });

        if (currentRequestId !== requestIdRef.current) return;

        const nextItems = replaces ? page.items : [...itemsRef.current, ...page.items];
        const nextHasMore = computeCursorHasMore(page.nextCursor, page.items.length);

        itemsRef.current = nextItems;
        lastFetchedPageRef.current = pageToFetch;
        nextCursorRef.current = page.nextCursor;
        hasMoreRef.current = nextHasMore;

        setItems(nextItems);
        setTotal(nextItems.length);
        setHasMore(nextHasMore);
        setError(null);
        return;
      }

      const result = await fetcherRef.current!({
        ...(paramsRef.current as TParams),
        page: pageToFetch,
        limit: currentLimit,
      });

      if (currentRequestId !== requestIdRef.current) return;

      // 先頭ページを skip なしで取ったとき (初回・revalidate・retry) だけ置き換える
      const replaces = pageToFetch === initialPageRef.current && skip === 0;
      const baseItems = replaces ? [] : itemsRef.current;
      const nextItems = [...baseItems, ...result.results.slice(skip)];
      // 終端判定はサーバーが返したページの件数で行う (skip で捨てた分も含む)
      const batchSize = result.results.length;
      const nextHasMore = computeHasMore(
        nextItems.length,
        result.total,
        batchSize,
        currentLimit,
      );

      itemsRef.current = nextItems;
      lastFetchedPageRef.current = pageToFetch;
      removedSinceFetchRef.current = replaces
        ? 0
        : Math.max(0, removedSinceFetchRef.current - removedAtStart);
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
        setHasFetchedOnce(true);
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
    fetchPage(pendingPageRef.current, pendingSkipRef.current);
  }, [enabled, fetchTick, fetchPage]);

  const triggerFetch = useCallback((pageToFetch: number, skip = 0) => {
    pendingPageRef.current = pageToFetch;
    pendingSkipRef.current = skip;
    skipNextFetchRef.current = false;
    setFetchTick((tick) => tick + 1);
  }, []);

  // 取得済み範囲の続きを取る (removeItems で詰まった分を補正する)
  const fetchNext = useCallback(() => {
    const { page, skip } = computeNextFetchPosition(
      lastFetchedPageRef.current,
      limitRef.current,
      removedSinceFetchRef.current,
    );
    triggerFetch(page, skip);
  }, [triggerFetch]);

  const loadMore = useCallback(() => {
    if (!enabledRef.current || isLoadingRef.current || !hasMoreRef.current) return;
    fetchNext();
  }, [fetchNext]);

  const retry = useCallback(() => {
    if (!enabledRef.current || isLoadingRef.current) return;
    fetchNext();
  }, [fetchNext]);

  const applyReset = useCallback((nextInitialData?: { items: TItem[]; total: number } | CursorPage<TItem>) => {
    const next = computeInitialState(
      nextInitialData,
      isCursorModeRef.current,
      limitRef.current,
      initialPageRef.current,
    );
    const hasInit = next.hasInitialData;
    const nextItems = next.items;
    const nextTotalValue = next.total;
    const nextLastFetched = next.lastFetchedPage;
    const nextHasMore = next.hasMore;
    nextCursorRef.current = next.nextCursor;

    // in-flight 無効化
    requestIdRef.current += 1;

    itemsRef.current = nextItems;
    lastFetchedPageRef.current = nextLastFetched;
    removedSinceFetchRef.current = 0;
    hasMoreRef.current = nextHasMore;
    isLoadingRef.current = false;

    setItems(nextItems);
    setTotal(nextTotalValue);
    setHasMore(nextHasMore);
    setError(null);
    setIsLoading(false);
    // initialData が無い reset では「これから初回 fetch を改めて行う」状態に戻す。
    // initialData があれば既に取得済み扱い。
    setHasFetchedOnce(hasInit);

    pendingPageRef.current = hasInit ? nextLastFetched + 1 : initialPageRef.current;
    pendingSkipRef.current = 0;
    skipNextFetchRef.current = hasInit;
    setFetchTick((tick) => tick + 1);
  }, []);

  const reset = useCallback(() => {
    applyReset(undefined);
  }, [applyReset]);

  /**
   * items / hasFetchedOnce を維持したまま、現在のクエリで 1 ページ目から再フェッチする。
   * アクション完了後の UI 最新化用 (SWR の mutate に近い用途)。
   *
   * 中間状態は古い items が表示されたまま、下端センチネルが回る (isFetchingMore=true) 見え方になる。
   * 完了時に setItems で新しいリストに上書きされる。
   *
   * 多ページ取得済みでも 1 ページ目だけ取り直して以降は loadMore で改めて取得し直す形に戻る。
   * 「アクション直後はリスト維持、裏で最新化したい」要件の標準 API。
   */
  const revalidate = useCallback(() => {
    if (!enabledRef.current) return;
    // in-flight 無効化
    requestIdRef.current += 1;
    // pagination だけ初期に戻す (items / hasFetchedOnce / total は据え置き)
    pendingPageRef.current = initialPageRef.current;
    pendingSkipRef.current = 0;
    lastFetchedPageRef.current = initialPageRef.current - 1;
    skipNextFetchRef.current = false;
    setFetchTick((tick) => tick + 1);
  }, []);

  const updateItems = useCallback(
    (
      predicate: (item: TItem) => boolean,
      updater: (item: TItem) => TItem,
    ) => {
      const nextItems = itemsRef.current.map((item) =>
        predicate(item) ? updater(item) : item,
      );
      itemsRef.current = nextItems;
      setItems(nextItems);
    },
    [],
  );

  const removeItems = useCallback((predicate: (item: TItem) => boolean) => {
    const nextItems = itemsRef.current.filter((item) => !predicate(item));
    const removedCount = itemsRef.current.length - nextItems.length;
    if (removedCount === 0) return;
    itemsRef.current = nextItems;
    // カーソルのモードは続きの位置が行の値で決まるので、外しても位置はずれない (補正しない)
    if (!isCursorModeRef.current) removedSinceFetchRef.current += removedCount;
    setItems(nextItems);
    setTotal((prev) => Math.max(0, prev - removedCount));
  }, []);

  // タブ復帰時の再取得 (opt-in)
  const hasFetchedOnceRef = useRef<boolean>(hasFetchedOnce);
  hasFetchedOnceRef.current = hasFetchedOnce;
  const lastFocusRevalidateAtRef = useRef<number>(0);
  useEffect(() => {
    if (!revalidateOnFocus || typeof window === "undefined") return;
    const handleFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (!enabledRef.current || isLoadingRef.current || !hasFetchedOnceRef.current) return;
      const now = Date.now();
      if (now - lastFocusRevalidateAtRef.current < FOCUS_REVALIDATE_THROTTLE_MS) return;
      lastFocusRevalidateAtRef.current = now;
      revalidate();
    };
    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [revalidateOnFocus, revalidate]);

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
      sentinelNodeRef.current = node;

      if (!node) return;

      observerRef.current = new IntersectionObserver((entries) => {
        // 交差遷移がキューされて複数エントリ届くことがあり、末尾が最新の状態
        const entry = entries[entries.length - 1];
        if (!entry?.isIntersecting) return;
        // guard は ref 経由で最新値を読む (Observer 自体は再生成せずに済む)
        if (!enabledRef.current || isLoadingRef.current || !hasMoreRef.current) return;
        fetchNext();
      }, observerOptionsRef.current);

      observerRef.current.observe(node);
    },
    [fetchNext],
  );

  // フェッチ完了後 (および enabled 復帰後) もセンチネルが可視のままだと
  // IntersectionObserver は遷移イベントを発火しない。re-observe して現在の
  // 交差状態を再配信させ、可視のままなら次ページを連鎖ロードする。
  // 終端は IO callback 内の guard と computeHasMore が保証する。
  useEffect(() => {
    if (isLoading || !enabled || !hasMore) return;
    const node = sentinelNodeRef.current;
    const observer = observerRef.current;
    if (!node || !observer) return;
    observer.unobserve(node);
    observer.observe(node);
  }, [isLoading, enabled, hasMore]);

  return {
    items,
    total,
    isLoading,
    // 初回ロード = 「まだ一度も fetch が完了していない (enabled=true 前提)」または
    // 「fetch in-flight で items が空 (reset 直後など)」。
    // mount 直後の useEffect 発火前 1 フレームでも true になるよう hasFetchedOnce で判定する。
    // enabled=false の場合はそもそも fetch しないので false (上位はローダーを出さない)。
    isInitialLoading: enabled && (!hasFetchedOnce || (isLoading && items.length === 0)),
    isFetchingMore: isLoading && items.length > 0,
    error,
    hasMore,
    // removeItems の補正込み (詰まった分を含むページ)
    nextPage: computeNextFetchPosition(
      lastFetchedPageRef.current,
      limit,
      removedSinceFetchRef.current,
    ).page,
    loadMore,
    retry,
    reset,
    revalidate,
    updateItems,
    removeItems,
    sentinelRef,
  };
}
