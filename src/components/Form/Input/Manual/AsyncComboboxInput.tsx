"use client";

// src/components/Form/Input/Manual/AsyncComboboxInput.tsx
//
// 非同期・単一選択コンボボックス。複数選択版(AsyncMultiSelectInput)と挙動を揃える:
//  - open 時に検索クエリ無しで一覧を先読み表示（browse モード / preloadOnOpen）。
//    Enter で検索（search モード）へ切替。クエリを空に戻すと browse へ復帰。
//  - 候補リストはスクロール末尾近接で自動次ページ取得（無限スクロール）。
//  - 選択中アイテムは検索/先読み結果に含まれなくてもリスト最上部に常時ピン留めし、
//    その行クリックで解除できる（単一選択なので「選択済みタブ」は設けず1行ピン留め）。
//  - 進行中リクエストは requestId で破棄し、open/close 連打・検索切替の競合に強い。

import {
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
  type UIEvent,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/_shadcn/command";
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "@/components/Overlays/Popover/PopoverPrimitives";
import { Button } from "@/components/Form/Button/Button";
import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";
import {
  serializeOptionValue,
  resolveOptionItemIdentity,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { cn } from "@/lib/cn";
import { type SearchParams, type PaginatedResult } from "@/lib/crud/types";

export type AsyncComboboxInputProps<T> = {
  /** 現在の値 */
  value?: OptionPrimitive | null;
  /** 値変更コールバック */
  onChange: (value: OptionPrimitive | null) => void;
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
  /**
   * open 時に検索クエリ無しで一覧（直近データ）を先読み表示するか（デフォルト: true）。
   * false にすると従来挙動（Enter 検索するまで一覧は出さない）に戻る。
   * 一覧の並び順は searchFn（= サービスの defaultOrderBy）に従う。
   */
  preloadOnOpen?: boolean;

  // ===== 初期表示用（編集画面で既存値を表示） =====
  /** 編集時の既存値のオプション */
  initialOption?: Options;

  // ===== UI =====
  /** トリガーのプレースホルダー */
  placeholder?: string;
  /** 検索欄のプレースホルダー */
  searchPlaceholder?: string;
  /** 結果0件時のメッセージ */
  emptyMessage?: string;
  /** 検索中のメッセージ */
  loadingMessage?: string;
  /** 初期状態のメッセージ（preloadOnOpen=false かつ未検索時に表示） */
  hintMessage?: string;
  /** 最低文字数未満時のメッセージ */
  minCharsMessage?: string;

  /** 無効化 */
  disabled?: boolean;
  /** クリア可能か（トリガー右端の ✕ ボタン。デフォルト: true） */
  clearable?: boolean;
  /** トリガーのクラス名 */
  className?: string;
  /** PopoverContent のクラス名 */
  contentClassName?: string;
  /** PopoverContent の props */
  popoverContentProps?: ComponentProps<typeof PopoverContent>;
  /** 開閉状態（制御モード） */
  open?: boolean;
  /** 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange">;

// ---- 内部ステート型（browse / search 共通） ----
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

const SCROLL_LOAD_THRESHOLD_PX = 100;

// ラベル未解決時の代替表示
function PendingLabel() {
  return <BaseSkeleton className="h-4 w-32 rounded" backgroundTone="subtle" />;
}

export function AsyncComboboxInput<T>({
  value,
  onChange,
  onBlur,
  searchFn,
  getOptionFromResult,
  searchFields,
  minChars = 1,
  limit = 20,
  preloadOnOpen = true,
  initialOption,
  placeholder = "選択してください",
  searchPlaceholder = "Enterで検索",
  emptyMessage = "該当する項目がありません",
  loadingMessage = "読み込み中...",
  hintMessage = "キーワードを入力してください",
  minCharsMessage,
  disabled,
  clearable = true,
  className,
  contentClassName,
  popoverContentProps,
  open,
  onOpenChange,
  ...rest
}: AsyncComboboxInputProps<T>) {
  // ---- 開閉 ----
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  // ---- 検索 / browse ----
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [browseState, setBrowseState] = useState<FetchState>(INITIAL_FETCH_STATE);
  const [searchState, setSearchState] = useState<FetchState>(INITIAL_FETCH_STATE);

  // 選択済みアイテムのキャッシュ（検索結果が入れ替わってもラベルを保持するため）
  const [selectedOptionCache, setSelectedOptionCache] = useState<Options | null>(null);

  // ---- リクエスト ID（競合破棄用） ----
  const browseRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);

  // ---- ロード（browse / search） ----
  const loadBrowsePage = useCallback(
    async (page: number, replace: boolean) => {
      const myId = ++browseRequestIdRef.current;
      setBrowseState((prev) => ({ ...prev, status: "loading", errorMessage: null }));
      try {
        const result = await searchFn({ page, limit });
        if (browseRequestIdRef.current !== myId) return;
        const newItems = result.results.map(getOptionFromResult);
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
    [searchFn, limit, getOptionFromResult],
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
    [searchQuery, minChars, searchFn, searchFields, limit, getOptionFromResult],
  );

  // ---- 開閉 ----
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) return;

      if (!isControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);

      if (nextOpen) {
        // 検索系を全リセット
        setSearchQuery("");
        setHasSearched(false);
        searchRequestIdRef.current++;
        setSearchState(INITIAL_FETCH_STATE);
        // browse は毎回 fresh fetch（最新データ）
        browseRequestIdRef.current++;
        setBrowseState(INITIAL_FETCH_STATE);
        if (preloadOnOpen) {
          loadBrowsePage(1, true);
        }
      } else {
        // ポップオーバーが閉じた時に onBlur を発火
        onBlur?.();
      }
    },
    [disabled, isControlled, onOpenChange, onBlur, preloadOnOpen, loadBrowsePage],
  );

  // ---- 検索 ----
  const handleSearchQueryChange = useCallback((val: string) => {
    setSearchQuery(val);
    if (val.trim() === "") {
      // クエリを空に戻したら browse へ復帰
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

  // ---- 選択 / 解除 ----
  const handleSelect = useCallback(
    (optionValue: OptionPrimitive) => {
      // 選択したアイテムの Options をキャッシュに保存（ラベル永続化）
      const serialized = serializeOptionValue(optionValue);
      const option =
        browseState.items.find((opt) => serializeOptionValue(opt.value) === serialized) ??
        searchState.items.find((opt) => serializeOptionValue(opt.value) === serialized);
      if (option) {
        setSelectedOptionCache(option);
      }
      onChange(optionValue);
      handleOpenChange(false);
    },
    [onChange, handleOpenChange, browseState.items, searchState.items],
  );

  const handleDeselect = useCallback(() => {
    // ピン留め行クリックでの解除。popover は開いたままにして再選択を可能にする。
    onChange(null);
    setSelectedOptionCache(null);
  }, [onChange]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setSelectedOptionCache(null);
      setSearchQuery("");
      setHasSearched(false);
      searchRequestIdRef.current++;
      setSearchState(INITIAL_FETCH_STATE);
    },
    [onChange],
  );

  // ---- 選択中のラベル解決: initialOption → cache → 取得済みリスト ----
  const selectedLabel = useMemo(() => {
    if (value === null || value === undefined) {
      return null;
    }
    const serializedValue = serializeOptionValue(value);

    if (initialOption && serializeOptionValue(initialOption.value) === serializedValue) {
      return initialOption.label;
    }
    if (selectedOptionCache && serializeOptionValue(selectedOptionCache.value) === serializedValue) {
      return selectedOptionCache.label;
    }
    const found =
      browseState.items.find((opt) => serializeOptionValue(opt.value) === serializedValue) ??
      searchState.items.find((opt) => serializeOptionValue(opt.value) === serializedValue);
    return found?.label ?? null;
  }, [value, initialOption, selectedOptionCache, browseState.items, searchState.items]);

  const hasValue = value !== null && value !== undefined;

  // ---- 現在モード（browse / search）の派生 ----
  const mode: "browse" | "search" = hasSearched ? "search" : "browse";
  const activeState = mode === "search" ? searchState : browseState;
  const browseHasMore =
    browseState.page > 0 && browseState.page * limit < browseState.total;
  const searchHasMore =
    searchState.page > 0 && searchState.page * limit < searchState.total;
  const hasMore = mode === "search" ? searchHasMore : browseHasMore;

  // 選択中アイテムはピン留めで別表示するため、本体リストからは除外（二重表示防止）
  const serializedValue = hasValue ? serializeOptionValue(value) : null;
  const listItems = useMemo(
    () =>
      serializedValue === null
        ? activeState.items
        : activeState.items.filter(
            (opt) => serializeOptionValue(opt.value) !== serializedValue,
          ),
    [activeState.items, serializedValue],
  );

  // ---- 無限スクロール ----
  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (distanceFromBottom > SCROLL_LOAD_THRESHOLD_PX) return;

      if (mode === "search") {
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
      mode,
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

  // ---- 選択中のピン留め行 ----
  const renderSelectedPinned = () => {
    if (!hasValue) return null;
    return (
      <>
        <CommandItem
          value="__selected__"
          onSelect={handleDeselect}
          className="cursor-pointer items-center gap-1"
        >
          <Check className="mr-2 size-4 opacity-100" />
          <span className="flex-1 truncate">{selectedLabel ?? <PendingLabel />}</span>
          <X className="size-4 shrink-0 opacity-50 hover:opacity-100" />
        </CommandItem>
        <CommandSeparator className="my-1" />
      </>
    );
  };

  // ---- 候補リストの表示内容 ----
  const renderListContent = () => {
    const trimmed = searchQuery.trim();

    // 初回ロード中（items 空）
    if (activeState.items.length === 0 && activeState.status === "loading") {
      return (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {loadingMessage}
        </div>
      );
    }

    // 初回エラー
    if (activeState.status === "error" && activeState.items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="text-sm text-destructive">{activeState.errorMessage}</span>
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
        </div>
      );
    }

    // browse 未ロード（preloadOnOpen=false）かつ未検索 → ヒント類
    if (mode === "browse" && browseState.page === 0 && browseState.status === "idle") {
      if (trimmed.length === 0) {
        return (
          <div className="py-6 text-center text-sm text-muted-foreground">{hintMessage}</div>
        );
      }
      if (trimmed.length < minChars) {
        return (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {minCharsMessage ?? `${minChars}文字以上入力してください`}
          </div>
        );
      }
      return (
        <div className="py-6 text-center text-sm text-muted-foreground">Enterキーで検索</div>
      );
    }

    // 結果0件（選択中ピン留めのみ残る場合も含む）
    if (listItems.length === 0 && activeState.status !== "loading") {
      // 選択中アイテムだけが該当していた場合はピン留めで見えているので空表示は出さない
      if (!hasValue || activeState.items.length === 0) {
        return <CommandEmpty>{emptyMessage}</CommandEmpty>;
      }
    }

    return (
      <>
        {listItems.map((option, index) => {
          const identity = resolveOptionItemIdentity(option, index);
          return (
            <CommandItem
              key={identity}
              value={identity}
              onSelect={() => handleSelect(option.value)}
              className="cursor-pointer"
            >
              <Check className="mr-2 size-4 opacity-0" />
              <span className="truncate">{option.label}</span>
            </CommandItem>
          );
        })}

        {/* フッタ: 追加読み込み中 / これ以上なし / 追加読み込みエラー */}
        {activeState.status === "loading" && activeState.items.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            読み込み中
          </div>
        )}
        {activeState.status === "idle" && !hasMore && activeState.items.length > 0 && (
          <div className="py-2 text-center text-xs text-muted-foreground">
            これ以上ありません
          </div>
        )}
        {activeState.status === "error" && activeState.items.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-xs text-destructive">
              {activeState.errorMessage ?? "追加読み込みに失敗しました"}
            </span>
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => {
                if (mode === "search") loadSearchPage(activeState.page + 1, false);
                else loadBrowsePage(activeState.page + 1, false);
              }}
            >
              再試行
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className={cn("w-full", className)} {...rest}>
      <PopoverRoot open={resolvedOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={resolvedOpen}
            disabled={disabled}
            className={cn(
              "h-auto w-full justify-between border-muted-foreground/50 py-3 font-normal",
              !hasValue && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {hasValue ? (selectedLabel ?? placeholder) : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {clearable && hasValue && (
                <X
                  className="size-4 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="size-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          layer="surface-ui"
          onOpenAutoFocus={(e) => {
            // radix の既定（content への focus）を抑止し、CommandInput の autoFocus に委譲
            e.preventDefault();
          }}
          {...popoverContentProps}
          className={cn(
            "w-[--radix-popover-trigger-width] p-0",
            contentClassName,
            popoverContentProps?.className
          )}
        >
          <Command shouldFilter={false}>
            <CommandInput
              autoFocus
              placeholder={searchPlaceholder}
              value={searchQuery}
              onValueChange={handleSearchQueryChange}
              onKeyDown={handleKeyDown}
            />
            <CommandList className="max-h-60" onScroll={handleScroll}>
              {renderSelectedPinned()}
              {renderListContent()}
            </CommandList>
          </Command>
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}
