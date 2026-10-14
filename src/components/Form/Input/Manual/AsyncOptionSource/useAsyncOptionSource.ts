"use client";

// src/components/Form/Input/Manual/AsyncOptionSource/useAsyncOptionSource.ts
//
// 非同期選択肢ソースの共通エンジン。
// AsyncComboboxInput / AsyncMultiSelectInput / Overlays/AsyncPickerModal の 3 消費者が
// 同じ取得挙動を共有するために切り出した（以前は各コンポーネントに同じコードがコピーされていた）。
//
//  - browse モード（クエリ無し・全件ページング）と search モード（Enter で確定）の 2 系統の FetchState
//  - 進行中リクエストは requestId で破棄し、open/close 連打・検索切替の競合に強い
//  - 候補リストのスクロール末尾近接で次ページを取得（無限スクロール）
//  - fetch 由来の行は value → { option, item } の cache に流し込み、ラベル解決と元レコード復元に使う
//
// 選択モデル（単一 / 複数 / session snapshot）とクローム（トリガー / Popover / Modal）は
// 消費者側の責務で、このフックには含めない。

import {
  type KeyboardEvent,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { serializeOptionValue, type OptionPrimitive } from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { type SearchParams, type PaginatedResult, type SearchRankSpec } from "@/lib/crud/types";

export type AsyncOptionFetchStatus = "idle" | "loading" | "error";

export type AsyncOptionFetchState = {
  items: Options[];
  page: number;
  total: number;
  status: AsyncOptionFetchStatus;
  errorMessage: string | null;
};

export type AsyncOptionMode = "browse" | "search";

export const INITIAL_ASYNC_OPTION_FETCH_STATE: AsyncOptionFetchState = {
  items: [],
  page: 0,
  total: 0,
  status: "idle",
  errorMessage: null,
};

/** スクロール末尾からこの距離（px）以内に入ったら次ページを取得する */
const SCROLL_LOAD_THRESHOLD_PX = 100;

export type UseAsyncOptionSourceOptions<T> = {
  /** 検索関数（既存の client.search をそのまま渡せる） */
  searchFn: (params: SearchParams) => Promise<PaginatedResult<T>>;
  /** T → Options に変換 */
  getOptionFromResult: (item: T) => Options;
  /** 検索対象フィールド */
  searchFields?: string[];
  /**
   * キーワード検索時の関連度ランキング（デフォルト: true）。
   * browse モード（searchQuery 無し）には影響しない。Firestore ドメインでは無視される。
   */
  searchRank?: boolean | SearchRankSpec;
  /** 最低入力文字数（デフォルト: 1） */
  minChars?: number;
  /** 1 ページあたりの取得件数（デフォルト: 20） */
  limit?: number;
  /** 編集時の既存選択肢ラベル（id → label のヒント）。cache に流し込まれ resolveOption で優先される */
  initialOptions?: Options[];
};

export type AsyncOptionSource<T> = {
  // ---- 検索クエリ ----
  searchQuery: string;
  /** 入力値を更新する。空文字に戻すと search モードを破棄して browse へ復帰する */
  setSearchQuery: (value: string) => void;
  /** 現在のクエリで search モードに入り 1 ページ目を取得する（minChars 未満は無視） */
  submitSearch: () => void;
  /** 検索欄の onKeyDown に渡す。Enter で submitSearch */
  handleSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;

  // ---- 取得状態 ----
  mode: AsyncOptionMode;
  browseState: AsyncOptionFetchState;
  searchState: AsyncOptionFetchState;
  /** 現在モードの FetchState */
  activeState: AsyncOptionFetchState;
  /** 現在モードに次ページがあるか */
  hasMore: boolean;
  /** browse の初回取得が開始済みか（preload しない運用でヒント表示を出す判定に使う） */
  isBrowseLoaded: boolean;

  // ---- 操作 ----
  /** open 時の初期化。クエリ・両モードの状態を破棄し、preload（既定 true）なら browse 1 ページ目を取得する */
  reset: (options?: { preload?: boolean }) => void;
  /** 現在モードの 1 ページ目を取り直す（初回エラーの再試行） */
  reloadFirstPage: () => void;
  /** 現在モードの次ページを取得する（hasMore かつ idle のときのみ） */
  loadMore: () => void;
  /** 追加読み込みエラー後の再試行。error 状態のときだけ次ページを取り直す */
  retryLoadMore: () => void;
  /** 候補リストの onScroll に渡す。末尾近接で loadMore */
  handleScroll: (event: UIEvent<HTMLDivElement>) => void;

  // ---- cache ----
  /** value → Options を解決する。initialOptions → fetch 由来 cache の順。未解決は undefined */
  resolveOption: (value: OptionPrimitive) => Options | undefined;
  /** value → 元レコード T を解決する。このフック経由で fetch された行だけが対象 */
  resolveItem: (value: OptionPrimitive) => T | undefined;
  /** cache の更新回数。resolveOption を useMemo / useCallback の deps に入れる際の再評価キー */
  cacheVersion: number;
};

type CacheEntry<T> = { option: Options; item?: T };

export function useAsyncOptionSource<T>({
  searchFn,
  getOptionFromResult,
  searchFields,
  searchRank = true,
  minChars = 1,
  limit = 20,
  initialOptions,
}: UseAsyncOptionSourceOptions<T>): AsyncOptionSource<T> {
  // ---- 検索 / browse ----
  const [searchQuery, setSearchQueryState] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [browseState, setBrowseState] = useState<AsyncOptionFetchState>(
    INITIAL_ASYNC_OPTION_FETCH_STATE,
  );
  const [searchState, setSearchState] = useState<AsyncOptionFetchState>(
    INITIAL_ASYNC_OPTION_FETCH_STATE,
  );

  // ---- リクエスト ID（競合破棄用） ----
  const browseRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);

  // ---- cache（value → option + 元レコード） ----
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  const cacheEntries = useCallback((entries: CacheEntry<T>[]) => {
    let touched = 0;
    for (const entry of entries) {
      const key = serializeOptionValue(entry.option.value);
      if (!key) continue;
      const prev = cacheRef.current.get(key);
      // item を持つ既存エントリを item 無しで上書きしない（initialOptions は label ヒントのみ）
      cacheRef.current.set(key, {
        option: entry.option,
        item: entry.item ?? prev?.item,
      });
      touched++;
    }
    // 既存キーの上書きでもラベルが変わりうるため、1 件でも触れたら version を進めて再評価させる
    if (touched > 0) setCacheVersion((v) => v + 1);
  }, []);

  // initialOptions の到着分を cache に流し込む（再 open 時の高速解決）
  useEffect(() => {
    if (initialOptions && initialOptions.length > 0) {
      cacheEntries(initialOptions.map((option) => ({ option })));
    }
  }, [initialOptions, cacheEntries]);

  // ---- ロード（browse / search） ----
  const loadBrowsePage = useCallback(
    async (page: number, replace: boolean) => {
      const myId = ++browseRequestIdRef.current;
      setBrowseState((prev) => ({ ...prev, status: "loading", errorMessage: null }));
      try {
        const result = await searchFn({ page, limit });
        if (browseRequestIdRef.current !== myId) return;
        const entries = result.results.map((item) => ({
          option: getOptionFromResult(item),
          item,
        }));
        cacheEntries(entries);
        const newItems = entries.map((e) => e.option);
        setBrowseState((prev) => ({
          items: replace ? newItems : [...prev.items, ...newItems],
          page,
          total: result.total,
          status: "idle",
          errorMessage: null,
        }));
      } catch (err) {
        if (browseRequestIdRef.current !== myId) return;
        setBrowseState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "読み込みに失敗しました",
        }));
      }
    },
    [searchFn, limit, getOptionFromResult, cacheEntries],
  );

  // searchRank は spec オブジェクトがインラインで渡されることが多いため、内容で同一性を判定する
  const searchRankKey = JSON.stringify(searchRank);
  const resolvedSearchRank = useMemo<SearchParams["searchRank"]>(
    () => searchRank,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchRankKey],
  );

  const loadSearchPage = useCallback(
    async (page: number, replace: boolean, queryOverride?: string) => {
      const trimmed = (queryOverride ?? searchQuery).trim();
      if (trimmed.length < minChars) return;

      const myId = ++searchRequestIdRef.current;
      setSearchState((prev) => ({ ...prev, status: "loading", errorMessage: null }));
      try {
        const result = await searchFn({
          searchQuery: trimmed,
          searchFields,
          searchRank: resolvedSearchRank,
          page,
          limit,
        });
        if (searchRequestIdRef.current !== myId) return;
        const entries = result.results.map((item) => ({
          option: getOptionFromResult(item),
          item,
        }));
        cacheEntries(entries);
        const newItems = entries.map((e) => e.option);
        setSearchState((prev) => ({
          items: replace ? newItems : [...prev.items, ...newItems],
          page,
          total: result.total,
          status: "idle",
          errorMessage: null,
        }));
      } catch (err) {
        if (searchRequestIdRef.current !== myId) return;
        setSearchState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "検索に失敗しました",
        }));
      }
    },
    [
      searchQuery,
      minChars,
      searchFn,
      searchFields,
      resolvedSearchRank,
      limit,
      getOptionFromResult,
      cacheEntries,
    ],
  );

  // ---- 初期化（open 時） ----
  const reset = useCallback(
    ({ preload = true }: { preload?: boolean } = {}) => {
      setSearchQueryState("");
      setHasSearched(false);
      searchRequestIdRef.current++;
      setSearchState(INITIAL_ASYNC_OPTION_FETCH_STATE);
      // browse は毎回 fresh fetch（最新データ）
      browseRequestIdRef.current++;
      setBrowseState(INITIAL_ASYNC_OPTION_FETCH_STATE);
      if (preload) {
        loadBrowsePage(1, true);
      }
    },
    [loadBrowsePage],
  );

  // ---- 検索 ----
  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value);
    if (value.trim() === "") {
      // クエリを空に戻したら browse へ復帰
      setHasSearched(false);
      searchRequestIdRef.current++;
      setSearchState(INITIAL_ASYNC_OPTION_FETCH_STATE);
    }
  }, []);

  const submitSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < minChars) return;
    setHasSearched(true);
    setSearchState(INITIAL_ASYNC_OPTION_FETCH_STATE);
    loadSearchPage(1, true);
  }, [searchQuery, minChars, loadSearchPage]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitSearch();
      }
    },
    [submitSearch],
  );

  // ---- 派生値 ----
  const mode: AsyncOptionMode = hasSearched ? "search" : "browse";
  const activeState = mode === "search" ? searchState : browseState;
  const browseHasMore = browseState.page > 0 && browseState.page * limit < browseState.total;
  const searchHasMore = searchState.page > 0 && searchState.page * limit < searchState.total;
  const hasMore = mode === "search" ? searchHasMore : browseHasMore;
  const isBrowseLoaded = browseState.page > 0 || browseState.status !== "idle";

  // ---- ページング操作 ----
  const reloadFirstPage = useCallback(() => {
    if (mode === "search") loadSearchPage(1, true);
    else loadBrowsePage(1, true);
  }, [mode, loadSearchPage, loadBrowsePage]);

  const loadMore = useCallback(() => {
    if (!hasMore || activeState.status !== "idle") return;
    if (mode === "search") loadSearchPage(activeState.page + 1, false);
    else loadBrowsePage(activeState.page + 1, false);
  }, [hasMore, activeState.status, activeState.page, mode, loadSearchPage, loadBrowsePage]);

  const retryLoadMore = useCallback(() => {
    if (activeState.status !== "error") return;
    if (mode === "search") loadSearchPage(activeState.page + 1, false);
    else loadBrowsePage(activeState.page + 1, false);
  }, [activeState.status, activeState.page, mode, loadSearchPage, loadBrowsePage]);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (distanceFromBottom > SCROLL_LOAD_THRESHOLD_PX) return;
      loadMore();
    },
    [loadMore],
  );

  // ---- cache 解決 ----
  // cacheVersion を deps に含めることで cache 更新時に参照が変わり、消費者側の useMemo が再評価される
  const resolveOption = useCallback(
    (value: OptionPrimitive): Options | undefined => {
      const key = serializeOptionValue(value);
      const fromInitial = initialOptions?.find((o) => serializeOptionValue(o.value) === key);
      if (fromInitial) return fromInitial;
      return cacheRef.current.get(key)?.option;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialOptions, cacheVersion],
  );

  const resolveItem = useCallback(
    (value: OptionPrimitive): T | undefined => {
      return cacheRef.current.get(serializeOptionValue(value))?.item;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheVersion],
  );

  return {
    searchQuery,
    setSearchQuery,
    submitSearch,
    handleSearchKeyDown,
    mode,
    browseState,
    searchState,
    activeState,
    hasMore,
    isBrowseLoaded,
    reset,
    reloadFirstPage,
    loadMore,
    retryLoadMore,
    handleScroll,
    resolveOption,
    resolveItem,
    cacheVersion,
  };
}
