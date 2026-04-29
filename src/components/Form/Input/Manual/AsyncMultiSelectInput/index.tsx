"use client";

// @/components/Form/Input/Manual/AsyncMultiSelectInput/index.tsx
//
// 構造:
//  - 「選択済み」タブ: ポップオーバー open 時の選択値を session snapshot として保持。
//    解除しても session 中はリスト上に「未選択」として残り、再選択可能。close で破棄、
//    再 open 時は最新の value から作り直す。
//  - 「検索」タブ: 検索クエリ空 → browse モード（全件ページング）。Enter → search モード。
//    候補リストはスクロール末尾近接で自動次ページ取得（無限スクロール）。
//    候補上の選択状態はチェックボックスで反映され、選択済もそのまま検索/閲覧で再表示される。
//  - 選択済の値は label 未解決でも必ず行表示する（Skeleton 代替）。initialOptions の後解決
//    およびリスト fetch 由来の cache は反映され、行のラベルがリアクティブに更新される。
//  - 進行中リクエストは requestId で破棄し、open/close 連打 / 検索切替の競合に強い。

import {
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2 } from "lucide-react";

import { Command, CommandInput } from "@/components/_shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/_shadcn/popover";
import { Button } from "@/components/Form/Button/Button";
import {
  normalizeOptionValues,
  toggleOptionValue,
  serializeOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { StateTabs, StateTabsContent } from "@/components/Navigation/StateTabs";
import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";
import { cn } from "@/lib/cn";
import { type SearchParams, type PaginatedResult } from "@/lib/crud/types";

import { MultiSelectTrigger } from "../MultiSelectInput/MultiSelectTrigger";
import { AsyncMultiSelectOptionList } from "./AsyncMultiSelectOptionList";

export type AsyncMultiSelectInputProps<T> = {
  /** 現在の値（選択されている値の配列） */
  value?: OptionPrimitive[] | null;
  /** フィールド名 */
  name?: string;
  /** 値変更コールバック */
  onChange: (value: OptionPrimitive[]) => void;
  /** blur コールバック（ポップオーバー閉じた時に発火） */
  onBlur?: () => void;

  // ===== 検索関数 =====
  /** 検索関数（既存のclient.searchをそのまま渡せる） */
  searchFn: (params: SearchParams) => Promise<PaginatedResult<T>>;
  /** T → Options に変換 */
  getOptionFromResult: (item: T) => Options;
  /** 検索対象フィールド */
  searchFields?: string[];

  // ===== オプション =====
  /** 最低入力文字数（デフォルト: 1） */
  minChars?: number;
  /** 1 ページあたりの取得件数（デフォルト: 20）。無限スクロールで複数ページ取得される */
  limit?: number;

  // ===== 初期表示用（編集画面で既存値を表示） =====
  /** 編集時の既存選択肢ラベル（id->label のヒント。未解決時は内部で fallback 表示） */
  initialOptions?: Options[];

  // ===== UI =====
  /** トリガーのプレースホルダー */
  placeholder?: string;
  /** 検索欄のプレースホルダー */
  searchPlaceholder?: string;
  /** 結果0件時のメッセージ */
  emptyMessage?: string;
  /** 検索中のメッセージ */
  loadingMessage?: string;

  /** 無効化 */
  disabled?: boolean;
  /** トリガーのクラス名 */
  triggerClassName?: string;
  /** PopoverContent のクラス名 */
  contentClassName?: string;
  /** PopoverContent の props */
  popoverContentProps?: ComponentProps<typeof PopoverContent>;
  /** 開閉状態（制御モード） */
  open?: boolean;
  /** 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange">;

// ---- 内部ステート型 ----

type FetchStatus = "idle" | "loading" | "error";

type FetchState = {
  items: Options[];
  page: number;
  total: number;
  status: FetchStatus;
  errorMessage: string | null;
};

const INITIAL_FETCH_STATE: FetchState = {
  items: [],
  page: 0,
  total: 0,
  status: "idle",
  errorMessage: null,
};

type ActiveTab = "selected" | "search";

const SCROLL_LOAD_THRESHOLD_PX = 100;

// ---- ラベル未解決時の代替表示 ----
function PendingLabel() {
  return <BaseSkeleton className="h-4 w-32 rounded" backgroundTone="subtle" />;
}

export function AsyncMultiSelectInput<T>({
  value,
  name: _name,
  onChange,
  onBlur,
  searchFn,
  getOptionFromResult,
  searchFields,
  minChars = 1,
  limit = 20,
  initialOptions,
  placeholder = "選択してください",
  searchPlaceholder = "Enterで検索",
  emptyMessage = "該当する項目がありません",
  loadingMessage = "読み込み中...",
  disabled,
  className,
  triggerClassName,
  contentClassName,
  popoverContentProps,
  open,
  onOpenChange,
  ...rest
}: AsyncMultiSelectInputProps<T>) {
  // ---- 開閉 ----
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  // ---- タブ ----
  const [activeTab, setActiveTab] = useState<ActiveTab>("selected");

  // ---- 検索/browse ----
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [browseState, setBrowseState] = useState<FetchState>(INITIAL_FETCH_STATE);
  const [searchState, setSearchState] = useState<FetchState>(INITIAL_FETCH_STATE);

  // ---- ラベル cache ----
  const labelCacheRef = useRef<Map<string, Options>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  const cacheOptions = useCallback((options: Options[]) => {
    let added = 0;
    for (const opt of options) {
      const key = serializeOptionValue(opt.value);
      if (!key) continue;
      const had = labelCacheRef.current.has(key);
      labelCacheRef.current.set(key, opt);
      if (!had) added++;
    }
    if (added > 0) setCacheVersion((v) => v + 1);
  }, []);

  // initialOptions の到着分を cache に流し込む（再 open 時の高速解決）
  useEffect(() => {
    if (initialOptions && initialOptions.length > 0) {
      cacheOptions(initialOptions);
    }
  }, [initialOptions, cacheOptions]);

  // ---- 選択済み snapshot（session スコープ） ----
  // open 時に value から初期化、解除しても session 中は残す。close で破棄して次回 open で作り直す。
  const [selectedSnapshot, setSelectedSnapshot] = useState<OptionPrimitive[]>([]);

  // ---- リクエスト ID（競合破棄用） ----
  const browseRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);

  // ---- 派生値 ----
  const selectedValues = normalizeOptionValues(value);
  const selectedCount = selectedValues.length;

  // ラベル解決: initialOptions → labelCache → Pending 代替
  // cacheVersion を deps に含めることで cache 更新時に再評価される
  const resolveLabel = useCallback(
    (v: OptionPrimitive): Options => {
      const key = serializeOptionValue(v);
      const fromInitial = initialOptions?.find(
        (o) => serializeOptionValue(o.value) === key,
      );
      if (fromInitial) return fromInitial;
      const fromCache = labelCacheRef.current.get(key);
      if (fromCache) return fromCache;
      return { value: v, label: <PendingLabel /> };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialOptions, cacheVersion],
  );

  // 「選択済み」タブで描画する Options 配列
  const selectedSnapshotOptions = useMemo<Options[]>(
    () => selectedSnapshot.map(resolveLabel),
    [selectedSnapshot, resolveLabel],
  );

  // ---- ロード（browse / search） ----
  const loadBrowsePage = useCallback(
    async (page: number, replace: boolean) => {
      const myId = ++browseRequestIdRef.current;
      setBrowseState((prev) => ({ ...prev, status: "loading", errorMessage: null }));
      try {
        const result = await searchFn({ page, limit });
        if (browseRequestIdRef.current !== myId) return;
        const newItems = result.results.map(getOptionFromResult);
        cacheOptions(newItems);
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
          errorMessage:
            err instanceof Error ? err.message : "読み込みに失敗しました",
        }));
      }
    },
    [searchFn, limit, getOptionFromResult, cacheOptions],
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
          page,
          limit,
        });
        if (searchRequestIdRef.current !== myId) return;
        const newItems = result.results.map(getOptionFromResult);
        cacheOptions(newItems);
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
          errorMessage:
            err instanceof Error ? err.message : "検索に失敗しました",
        }));
      }
    },
    [searchQuery, minChars, searchFn, searchFields, limit, getOptionFromResult, cacheOptions],
  );

  // ---- 開閉 ----
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) return;

      if (!isControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);

      if (nextOpen) {
        // session snapshot を current value で初期化
        const currentValues = normalizeOptionValues(value);
        setSelectedSnapshot([...currentValues]);
        // デフォルトタブ: 検索（入力フィールドにフォーカスを当てて即タイピング可能にする）
        setActiveTab("search");
        // 検索系を全リセット
        setSearchQuery("");
        setHasSearched(false);
        searchRequestIdRef.current++;
        setSearchState(INITIAL_FETCH_STATE);
        // browse は毎回 fresh fetch（最新データ）
        setBrowseState(INITIAL_FETCH_STATE);
        loadBrowsePage(1, true);
      } else {
        onBlur?.();
      }
    },
    [disabled, isControlled, onOpenChange, onBlur, value, loadBrowsePage],
  );

  // ---- 検索 ----
  const handleSearchQueryChange = useCallback((val: string) => {
    setSearchQuery(val);
    if (val.trim() === "") {
      setHasSearched(false);
      searchRequestIdRef.current++;
      setSearchState(INITIAL_FETCH_STATE);
    }
  }, []);

  const handleSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < minChars) return;
    setHasSearched(true);
    setSearchState(INITIAL_FETCH_STATE);
    loadSearchPage(1, true);
  }, [searchQuery, minChars, loadSearchPage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch],
  );

  // ---- トグル ----
  const handleToggle = useCallback(
    (optionValue: OptionPrimitive) => {
      const key = serializeOptionValue(optionValue);
      const current = normalizeOptionValues(value);
      const newValues = toggleOptionValue(current, optionValue);
      const isAdding = newValues.length > current.length;

      if (isAdding) {
        // 行データから cache へ流し込む（label 永続化）
        const found =
          browseState.items.find((o) => serializeOptionValue(o.value) === key) ??
          searchState.items.find((o) => serializeOptionValue(o.value) === key) ??
          initialOptions?.find((o) => serializeOptionValue(o.value) === key);
        if (found) {
          labelCacheRef.current.set(key, found);
          setCacheVersion((v) => v + 1);
        }
        // snapshot に未収録なら末尾追加（順序固定 / 解除しても残す）
        setSelectedSnapshot((prev) => {
          const exists = prev.some((v0) => serializeOptionValue(v0) === key);
          return exists ? prev : [...prev, optionValue];
        });
      }
      // 解除: snapshot は維持

      onChange(newValues);
    },
    [onChange, value, browseState.items, searchState.items, initialOptions],
  );

  const handleClosePicker = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  // ---- 無限スクロール（候補リストの onScroll に基づく） ----
  const browseHasMore =
    browseState.page > 0 && browseState.page * limit < browseState.total;
  const searchHasMore =
    searchState.page > 0 && searchState.page * limit < searchState.total;

  const handleCandidateScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const distanceFromBottom =
        el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (distanceFromBottom > SCROLL_LOAD_THRESHOLD_PX) return;

      if (hasSearched) {
        if (searchHasMore && searchState.status === "idle") {
          loadSearchPage(searchState.page + 1, false);
        }
      } else {
        if (browseHasMore && browseState.status === "idle") {
          loadBrowsePage(browseState.page + 1, false);
        }
      }
    },
    [
      hasSearched,
      searchHasMore,
      searchState.status,
      searchState.page,
      browseHasMore,
      browseState.status,
      browseState.page,
      loadSearchPage,
      loadBrowsePage,
    ],
  );

  // ---- 候補タブの表示内容 ----
  const renderCandidateList = () => {
    const mode: "browse" | "search" = hasSearched ? "search" : "browse";
    const state = mode === "search" ? searchState : browseState;
    const hasMore = mode === "search" ? searchHasMore : browseHasMore;

    // 初回ロード中（items 空）
    if (state.items.length === 0 && state.status === "loading") {
      return (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {loadingMessage}
        </div>
      );
    }

    // 初回エラー
    if (state.status === "error" && state.items.length === 0) {
      return (
        <Stack space={2} padding="md" className="items-center">
          <span className="text-sm text-destructive">
            {state.errorMessage ?? "読み込みに失敗しました"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (mode === "search") loadSearchPage(1, true);
              else loadBrowsePage(1, true);
            }}
          >
            再試行
          </Button>
        </Stack>
      );
    }

    return (
      <AsyncMultiSelectOptionList
        options={state.items}
        selectedValues={selectedValues}
        onToggle={handleToggle}
        emptyMessage={emptyMessage}
        onScroll={handleCandidateScroll}
        footer={
          <>
            {state.status === "loading" && state.items.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                読み込み中
              </div>
            )}
            {state.status === "idle" && !hasMore && state.items.length > 0 && (
              <div className="py-2 text-center text-xs text-muted-foreground">
                これ以上ありません
              </div>
            )}
            {state.status === "error" && state.items.length > 0 && (
              <Flex justify="center" padding="xs" className="gap-2">
                <span className="text-xs text-destructive">
                  {state.errorMessage ?? "追加読み込みに失敗しました"}
                </span>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => {
                    if (mode === "search") {
                      loadSearchPage(state.page + 1, false);
                    } else {
                      loadBrowsePage(state.page + 1, false);
                    }
                  }}
                >
                  再試行
                </button>
              </Flex>
            )}
          </>
        }
      />
    );
  };

  // ---- レンダリング ----
  return (
    <div className={cn("w-full", className)} {...rest}>
      <Popover open={resolvedOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <MultiSelectTrigger
            placeholder={placeholder}
            selectedCount={selectedCount}
            open={resolvedOpen}
            disabled={disabled}
            className={triggerClassName}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          onOpenAutoFocus={(e) => {
            // radix の既定（content への focus）を抑止し、CommandInput の autoFocus に委譲
            e.preventDefault();
          }}
          {...popoverContentProps}
          className={cn(
            "surface-ui-layer w-[min(360px,90vw)] p-0",
            contentClassName,
            popoverContentProps?.className,
          )}
        >
          <Stack space={0} padding="none">
            <Command shouldFilter={false}>
              <StateTabs
                size="sm"
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as ActiveTab)}
                tabs={[
                  { value: "search", label: "検索" },
                  { value: "selected", label: `選択済み (${selectedCount})` },
                ]}
                className="px-2 pt-2"
                listClassName="w-full"
              >
                <StateTabsContent value="selected">
                  {selectedSnapshotOptions.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      選択された項目はありません
                    </div>
                  ) : (
                    <AsyncMultiSelectOptionList
                      options={selectedSnapshotOptions}
                      selectedValues={selectedValues}
                      onToggle={handleToggle}
                      emptyMessage="選択された項目はありません"
                    />
                  )}
                </StateTabsContent>

                <StateTabsContent value="search">
                  <CommandInput
                    autoFocus
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onValueChange={handleSearchQueryChange}
                    onKeyDown={handleKeyDown}
                  />
                  {renderCandidateList()}
                </StateTabsContent>
              </StateTabs>
            </Command>
            <Flex
              padding="sm"
              justify="end"
              className="border-t border-border bg-popover"
            >
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  handleClosePicker();
                }}
              >
                選択を確定
              </Button>
            </Flex>
          </Stack>
        </PopoverContent>
      </Popover>
    </div>
  );
}
