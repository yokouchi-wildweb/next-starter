"use client";

// src/components/Input/AsyncComboboxInput.tsx
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
  useRef,
  useEffect,
} from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Command, CommandInput, CommandItem, CommandSeparator } from "@/components/Primitives/Command";
import { StateTabs } from "@/components/Navigation/StateTabs";
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "@/components/Primitives/Popover";
import { Button } from "@/components/Button/Button";
import { serializeOptionValue, type OptionPrimitive } from "@/components/Input/options";
import { type Options } from "@/components/Input/options";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";

import { inputVariants, type InputSize } from "./Input";
import type { AsyncSearchParams, AsyncSearchResult, AsyncSearchRankSpec } from "@/components/Input/AsyncOptionSource";

import {
  AsyncOptionInitialState,
  AsyncOptionList,
  AsyncOptionListFooter,
  PICKER_POPOVER_BODY_CLASS,
  PendingOptionLabel,
  isAsyncOptionInitialState,
  type AsyncOptionRenderer,
  useAsyncOptionSource,
  usePickerPopoverSide,
} from "./AsyncOptionSource";

/** 縮めずに出したい中身の高さ（検索欄 + 候補リスト max-h-60） */
const PREFERRED_POPOVER_HEIGHT = 280;

/** 候補を切り替える範囲のタブ 1 つ(count があればラベルの後ろに「(n)」) */
export type AsyncComboboxScope = {
  value: string;
  label: ReactNode;
  count?: number;
};

/** 候補の一番上に常に出す「すべて」の選択肢。value は呼び手が決める(未選択 = null・クリアと区別する) */
export type AsyncComboboxAllOption = {
  value: OptionPrimitive;
  label: ReactNode;
};

/** searchFn の第 2 引数。scopes を渡した時は選んでいる範囲 */
export type AsyncComboboxSearchContext = {
  scope?: string;
};

export type AsyncComboboxInputProps<T> = {
  /** 引き金の高さの段(入力欄・ボタンの size と同じ名前・同じ高さ)@default "md" */
  size?: InputSize;
  /** 現在の値 */
  value?: OptionPrimitive | null;
  /** 値変更コールバック */
  onChange: (value: OptionPrimitive | null) => void;
  /** blur コールバック（ポップオーバー閉じた時に発火） */
  onBlur?: () => void;

  // ===== 検索関数 =====
  /** 検索関数（既存のclient.searchをそのまま渡せる）。scopes を渡した時は第 2 引数に { scope } が来る */
  searchFn: (params: AsyncSearchParams, context: AsyncComboboxSearchContext) => Promise<AsyncSearchResult<T>>;
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
  searchRank?: boolean | AsyncSearchRankSpec;

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
  /** 候補の行と上に留める選んだ行の表示を差し替える（状態のバッジを並べる等）。
   * item は取得済みの元の行（未取得なら undefined）。トリガーの表示は label のまま */
  renderOption?: AsyncOptionRenderer<T>;

  // ===== 範囲のタブ・「すべて」 =====
  /** 候補を切り替える範囲のタブ（検索欄の下）。替えると選んだ範囲で候補を取り直す（searchFn の第 2 引数 { scope }） */
  scopes?: AsyncComboboxScope[];
  /** 選んでいる範囲（制御モード） */
  scope?: string;
  /** 非制御時の最初の範囲（省略時は先頭） */
  defaultScope?: string;
  /** 範囲の変更通知 */
  onScopeChange?: (scope: string) => void;
  /** 候補の一番上に常に出す「すべて」の選択肢。選ぶと onChange(allOption.value)、その値の時はトリガーに allOption.label */
  allOption?: AsyncComboboxAllOption;
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
  size = "md",
  clearable = true,
  className,
  contentClassName,
  popoverContentProps,
  open,
  onOpenChange,
  renderOption,
  scopes,
  scope,
  defaultScope,
  onScopeChange,
  allOption,
  id,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
  ...rest
}: AsyncComboboxInputProps<T>) {
  // ---- 開閉 ----
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;
  const { side, anchorRef, measure } = usePickerPopoverSide(PREFERRED_POPOVER_HEIGHT);

  // ---- 取得エンジン ----
  // initialOption は毎 render 同じ参照とは限らないため、配列化は useMemo で固定する
  const initialOptions = useMemo(
    () => (initialOption ? [initialOption] : undefined),
    [initialOption],
  );
  // ---- 範囲 ----
  const hasScopes = Boolean(scopes && scopes.length > 0);
  const [internalScope, setInternalScope] = useState<string | undefined>(defaultScope ?? scopes?.[0]?.value);
  const currentScope = hasScopes ? (scope ?? internalScope) : undefined;
  // 取得の関数は範囲を ref で読む（範囲を替えた直後の取り直しが新しい値で走るように）
  const scopeRef = useRef(currentScope);
  const scopedSearchFn = useCallback(
    (params: AsyncSearchParams) => searchFn(params, { scope: scopeRef.current }),
    [searchFn],
  );

  const source = useAsyncOptionSource<T>({
    searchFn: scopedSearchFn,
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
        // 下の空きが足りず上の方が広ければ上へ開く（popoverSide.ts）
        measure();
        reset({ preload: preloadOnOpen });
      } else {
        // ポップオーバーが閉じた時に onBlur を発火
        onBlur?.();
      }
    },
    [disabled, isControlled, onOpenChange, onBlur, preloadOnOpen, reset, measure],
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

  // ---- 範囲の切り替え: 選んだ範囲で今のモード（先読み / 検索）の 1 ページ目を取り直す ----
  const { mode: sourceMode, reloadFirstPage } = source;
  useEffect(() => {
    if (scopeRef.current === currentScope) return;
    scopeRef.current = currentScope;
    if (!resolvedOpen) return;
    if (sourceMode === "search") reloadFirstPage();
    else reset({ preload: true });
  }, [currentScope, resolvedOpen, sourceMode, reloadFirstPage, reset]);
  const handleScopeChange = useCallback(
    (next: string) => {
      if (scope === undefined) setInternalScope(next);
      onScopeChange?.(next);
    },
    [scope, onScopeChange],
  );

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
  const { resolveOption, resolveItem } = source;
  // 「すべて」を選んでいるか（値は呼び手が決める。null = 未選択とは別）
  const isAllSelected =
    allOption !== undefined && hasValue && serializeOptionValue(value) === serializeOptionValue(allOption.value);
  const selectedLabel = useMemo(
    () =>
      isAllSelected
        ? allOption!.label
        : value !== null && value !== undefined
          ? (resolveOption(value)?.label ?? null)
          : null,
    [isAllSelected, allOption, value, resolveOption],
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

  // ---- 行の描き分け（呼び手の renderOption に取得済みの元の行を添える） ----
  const selectedOption = useMemo(
    () => (renderOption && value !== null && value !== undefined ? resolveOption(value) : undefined),
    [renderOption, value, resolveOption],
  );
  const renderRow = useMemo(
    () => (renderOption ? (option: Options) => renderOption(option, resolveItem(option.value)) : undefined),
    [renderOption, resolveItem],
  );

  // ---- 選択中のピン留め行 ----
  const pinnedRow = hasValue && !isAllSelected ? (
    <>
      <CommandItem
        value="__selected__"
        onSelect={handleDeselect}
        className="cursor-pointer items-center gap-1"
      >
        <Check className="mr-2 size-4 opacity-100" />
        {renderOption && selectedOption ? (
          <span className="min-w-0 flex-1">{renderOption(selectedOption, resolveItem(selectedOption.value))}</span>
        ) : (
          <span className="flex-1 truncate">{selectedLabel ?? <PendingOptionLabel />}</span>
        )}
        <X className="size-4 shrink-0 opacity-50 hover:opacity-100" />
      </CommandItem>
      <CommandSeparator className="my-1" />
    </>
  ) : null;

  // ---- 「すべて」の行（読み込み中・空でも候補の一番上に常に出す） ----
  const allRow = allOption ? (
    <CommandItem
      value="__all__"
      onSelect={() => handleSelect(allOption.value)}
      className="cursor-pointer items-center gap-1"
    >
      <Check className={cn("mr-2 size-4", isAllSelected ? "opacity-100" : "opacity-0")} />
      <span className="flex-1 truncate">{allOption.label}</span>
    </CommandItem>
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
    <div ref={anchorRef} className={cn("w-full", className)} {...rest}>
      <PopoverRoot open={resolvedOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            aria-describedby={ariaDescribedby}
            aria-invalid={ariaInvalid}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={resolvedOpen}
            disabled={disabled}
            className={inputVariants({
              size,
              className: cn("w-full justify-between font-normal", !hasValue && "text-muted-foreground"),
            })}
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
          side={side}
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
          {/* スクロール領域は候補リストだけ: 上限を Command に付け、min-h-0 でリストを縮める */}
          <Command shouldFilter={false} className={PICKER_POPOVER_BODY_CLASS}>
            <CommandInput
              autoFocus
              placeholder={searchPlaceholder}
              value={source.searchQuery}
              onValueChange={source.setSearchQuery}
              onKeyDown={source.handleSearchKeyDown}
            />
            {hasScopes ? (
              <StateTabs
                tabs={scopes!.map((s) => ({
                  value: s.value,
                  label:
                    s.count === undefined ? (
                      s.label
                    ) : (
                      <>
                        {s.label}
                        <span className="ml-1 text-xs opacity-70">({s.count})</span>
                      </>
                    ),
                }))}
                value={currentScope}
                onValueChange={handleScopeChange}
                size="xs"
                ariaLabel="候補の範囲"
                className="shrink-0 border-b p-1"
              >
                {null}
              </StateTabs>
            ) : null}
            <AsyncOptionList
              selectionMode="single"
              options={isInitialState || isHintState ? [] : listItems}
              selectedValues={EMPTY_VALUES}
              onToggle={handleSelect}
              emptyMessage={showEmpty ? emptyMessage : null}
              header={
                allRow ? (
                  <>
                    {allRow}
                    {pinnedRow}
                  </>
                ) : (
                  pinnedRow
                )
              }
              renderOption={renderRow}
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
