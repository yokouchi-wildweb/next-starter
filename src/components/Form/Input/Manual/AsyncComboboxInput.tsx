"use client";

// src/components/Form/Input/Manual/AsyncComboboxInput.tsx
//
// 非同期・単一選択コンボボックス。取得エンジンは AsyncOptionSource/useAsyncOptionSource に共通化
// （複数選択版 AsyncMultiSelectInput / モーダル版 Overlays/AsyncPickerModal と同じ挙動）:
//  - open 時に検索クエリ無しで一覧を先読み表示（browse モード / preloadOnOpen）。
//    Enter で検索（search モード）へ切替。クエリを空に戻すと browse へ復帰。
//  - 候補リストはスクロール末尾近接で自動次ページ取得（無限スクロール）。
//  - 選択中アイテムは検索/先読み結果に含まれなくてもリスト最上部に常時ピン留めし、
//    その行クリックで解除できる（単一選択なので「選択済みタブ」は設けず1行ピン留め）。
//  - 進行中リクエストは requestId で破棄し、open/close 連打・検索切替の競合に強い。

import {
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Command, CommandInput, CommandItem, CommandSeparator } from "@/components/_shadcn/command";
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "@/components/Overlays/Popover/PopoverPrimitives";
import { Button } from "@/components/Form/Button/Button";
import { serializeOptionValue, type OptionPrimitive } from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";
import { type SearchParams, type PaginatedResult, type SearchRankSpec } from "@/lib/crud/types";

import {
  AsyncOptionInitialState,
  AsyncOptionList,
  AsyncOptionListFooter,
  PendingOptionLabel,
  isAsyncOptionInitialState,
  useAsyncOptionSource,
} from "./AsyncOptionSource";

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
  /**
   * キーワード検索時の関連度ランキング（デフォルト: true）。
   * true = サービス既定（defaultSearchRank、無ければ searchFields 等重み）で
   * 「完全一致 > 前置一致 > 語頭一致 > 部分一致」の順に並べる。
   * false = 従来の並び順（サービスの defaultOrderBy）。spec を渡すと重みを個別指定できる。
   * 先読み一覧（searchQuery 無し）には影響しない。Firestore ドメインでは無視される。
   */
  searchRank?: boolean | SearchRankSpec;

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

const EMPTY_VALUES: OptionPrimitive[] = [];

export function AsyncComboboxInput<T>({
  value,
  onChange,
  onBlur,
  searchFn,
  getOptionFromResult,
  searchFields,
  searchRank = true,
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

  // ---- 取得エンジン ----
  // initialOption は毎 render 同じ参照とは限らないため、配列化は useMemo で固定する
  const initialOptions = useMemo(
    () => (initialOption ? [initialOption] : undefined),
    [initialOption],
  );
  const source = useAsyncOptionSource<T>({
    searchFn,
    getOptionFromResult,
    searchFields,
    searchRank,
    minChars,
    limit,
    initialOptions,
  });

  // ---- 開閉 ----
  const { reset } = source;
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) return;

      if (!isControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);

      if (nextOpen) {
        reset({ preload: preloadOnOpen });
      } else {
        // ポップオーバーが閉じた時に onBlur を発火
        onBlur?.();
      }
    },
    [disabled, isControlled, onOpenChange, onBlur, preloadOnOpen, reset],
  );

  // ---- 選択 / 解除 ----
  const handleSelect = useCallback(
    (optionValue: OptionPrimitive) => {
      // ラベルは fetch 時に cache 済み（検索結果が入れ替わっても解決できる）
      onChange(optionValue);
      handleOpenChange(false);
    },
    [onChange, handleOpenChange],
  );

  const handleDeselect = useCallback(() => {
    // ピン留め行クリックでの解除。popover は開いたままにして再選択を可能にする。
    onChange(null);
  }, [onChange]);

  const { setSearchQuery } = source;
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setSearchQuery("");
    },
    [onChange, setSearchQuery],
  );

  // ---- 選択中のラベル解決: initialOption → cache（fetch 由来） ----
  const hasValue = value !== null && value !== undefined;
  const { resolveOption } = source;
  const selectedLabel = useMemo(
    () =>
      value !== null && value !== undefined ? (resolveOption(value)?.label ?? null) : null,
    [value, resolveOption],
  );

  // ---- 現在モードの派生 ----
  const { mode, activeState, hasMore, isBrowseLoaded } = source;

  // 選択中アイテムはピン留めで別表示するため、本体リストからは除外（二重表示防止）
  const serializedValue = hasValue ? serializeOptionValue(value) : null;
  const listItems = useMemo(
    () =>
      serializedValue === null
        ? activeState.items
        : activeState.items.filter((opt) => serializeOptionValue(opt.value) !== serializedValue),
    [activeState.items, serializedValue],
  );

  // ---- 選択中のピン留め行 ----
  const pinnedRow = hasValue ? (
    <>
      <CommandItem
        value="__selected__"
        onSelect={handleDeselect}
        className="cursor-pointer items-center gap-1"
      >
        <Check className="mr-2 size-4 opacity-100" />
        <span className="flex-1 truncate">{selectedLabel ?? <PendingOptionLabel />}</span>
        <X className="size-4 shrink-0 opacity-50 hover:opacity-100" />
      </CommandItem>
      <CommandSeparator className="my-1" />
    </>
  ) : null;

  // ---- 候補リストの状態表示（初回ロード / 初回エラー / ヒント / 末尾） ----
  const isInitialState = isAsyncOptionInitialState(activeState);
  const isHintState = mode === "browse" && !isBrowseLoaded;

  const renderStatus = (): ReactNode => {
    if (isInitialState) {
      return (
        <AsyncOptionInitialState
          state={activeState}
          loadingMessage={loadingMessage}
          onRetry={source.reloadFirstPage}
        />
      );
    }

    // browse 未ロード（preloadOnOpen=false）かつ未検索 → ヒント類
    if (isHintState) {
      const trimmed = source.searchQuery.trim();
      const text =
        trimmed.length === 0
          ? hintMessage
          : trimmed.length < minChars
            ? (minCharsMessage ?? `${minChars}文字以上入力してください`)
            : "Enterキーで検索";
      return (
        <Span size="sm" tone="muted" align="center" className="block py-6">
          {text}
        </Span>
      );
    }

    return (
      <AsyncOptionListFooter
        state={activeState}
        hasMore={hasMore}
        onRetry={source.retryLoadMore}
      />
    );
  };

  // 結果0件表示: 選択中アイテムだけが該当していた場合はピン留めで見えているので出さない
  const showEmpty =
    !isInitialState &&
    !isHintState &&
    listItems.length === 0 &&
    activeState.status !== "loading" &&
    (!hasValue || activeState.items.length === 0);

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
              value={source.searchQuery}
              onValueChange={source.setSearchQuery}
              onKeyDown={source.handleSearchKeyDown}
            />
            <AsyncOptionList
              selectionMode="single"
              options={isInitialState || isHintState ? [] : listItems}
              selectedValues={EMPTY_VALUES}
              onToggle={handleSelect}
              emptyMessage={showEmpty ? emptyMessage : null}
              header={pinnedRow}
              footer={renderStatus()}
              className="gap-0"
              onScroll={source.handleScroll}
            />
          </Command>
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}
