"use client";

// @/components/Form/Input/Manual/AsyncMultiSelectInput/index.tsx
//
// 非同期・複数選択ピッカー（Popover 版）。取得エンジンは AsyncOptionSource/useAsyncOptionSource に共通化。
// 構造:
//  - 「選択済み」タブ: ポップオーバー open 時の選択値を session snapshot として保持。
//    解除しても session 中はリスト上に「未選択」として残り、再選択可能。close で破棄、
//    再 open 時は最新の value から作り直す。
//  - 「検索」タブ: 検索クエリ空 → browse モード（全件ページング）。Enter → search モード。
//    候補リストはスクロール末尾近接で自動次ページ取得（無限スクロール）。
//    候補上の選択状態はチェックボックスで反映され、選択済もそのまま検索/閲覧で再表示される。
//  - 選択済の値は label 未解決でも必ず行表示する（Skeleton 代替）。initialOptions の後解決
//    およびリスト fetch 由来の cache は反映され、行のラベルがリアクティブに更新される。
//
// 同じエンジンをモーダル本体として描画する版 = Overlays/AsyncPickerModal。

import {
  type ComponentProps,
  type HTMLAttributes,
  type MouseEvent,
  useCallback,
  useMemo,
  useState,
} from "react";

import { Command, CommandInput } from "@/components/_shadcn/command";
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "@/components/Overlays/Popover/PopoverPrimitives";
import { Button } from "@/components/Form/Button/Button";
import {
  normalizeOptionValues,
  toggleOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { StateTabs, StateTabsContent } from "@/components/Navigation/StateTabs";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";
import { type SearchParams, type PaginatedResult, type SearchRankSpec } from "@/lib/crud/types";

import { MultiSelectTrigger } from "../MultiSelectInput/MultiSelectTrigger";
import {
  AsyncOptionInitialState,
  AsyncOptionList,
  AsyncOptionListFooter,
  PendingOptionLabel,
  isAsyncOptionInitialState,
  useAsyncOptionSource,
  useSelectionSnapshot,
} from "../AsyncOptionSource";

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
  /**
   * キーワード検索時の関連度ランキング（デフォルト: true）。
   * true = サービス既定（defaultSearchRank、無ければ searchFields 等重み）で
   * 「完全一致 > 前置一致 > 語頭一致 > 部分一致」の順に並べる。
   * false = 従来の並び順（サービスの defaultOrderBy）。spec を渡すと重みを個別指定できる。
   * browse モード（searchQuery 無し）には影響しない。Firestore ドメインでは無視される。
   */
  searchRank?: boolean | SearchRankSpec;

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

type ActiveTab = "selected" | "search";

export function AsyncMultiSelectInput<T>({
  value,
  name: _name,
  onChange,
  onBlur,
  searchFn,
  getOptionFromResult,
  searchFields,
  searchRank = true,
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

  // ---- 取得エンジン ----
  const source = useAsyncOptionSource<T>({
    searchFn,
    getOptionFromResult,
    searchFields,
    searchRank,
    minChars,
    limit,
    initialOptions,
  });

  // ---- 選択済み snapshot（session スコープ） ----
  const selection = useSelectionSnapshot();

  // ---- 派生値 ----
  const selectedValues = normalizeOptionValues(value);
  const selectedCount = selectedValues.length;

  // ラベル解決: initialOptions → cache → Pending 代替
  const { resolveOption } = source;
  const resolveLabel = useCallback(
    (v: OptionPrimitive): Options => resolveOption(v) ?? { value: v, label: <PendingOptionLabel /> },
    [resolveOption],
  );

  // 「選択済み」タブで描画する Options 配列
  const selectedSnapshotOptions = useMemo<Options[]>(
    () => selection.snapshot.map(resolveLabel),
    [selection.snapshot, resolveLabel],
  );

  // ---- 開閉 ----
  const { reset } = source;
  const { start: startSnapshot } = selection;
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) return;

      if (!isControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);

      if (nextOpen) {
        // session snapshot を current value で初期化
        startSnapshot(normalizeOptionValues(value));
        // デフォルトタブ: 検索（入力フィールドにフォーカスを当てて即タイピング可能にする）
        setActiveTab("search");
        // 検索系を全リセットし browse を fresh fetch
        reset();
      } else {
        onBlur?.();
      }
    },
    [disabled, isControlled, onOpenChange, onBlur, value, reset, startSnapshot],
  );

  // ---- トグル ----
  const { add: addToSnapshot } = selection;
  const handleToggle = useCallback(
    (optionValue: OptionPrimitive) => {
      const current = normalizeOptionValues(value);
      const newValues = toggleOptionValue(current, optionValue);
      const isAdding = newValues.length > current.length;

      // 追加時は snapshot に未収録なら末尾追加（順序固定 / 解除しても残す）。ラベルは cache が保持済み
      if (isAdding) addToSnapshot(optionValue);

      onChange(newValues);
    },
    [onChange, value, addToSnapshot],
  );

  const handleClosePicker = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  // ---- 候補タブの表示内容 ----
  const renderCandidateList = () => {
    const state = source.activeState;

    if (isAsyncOptionInitialState(state)) {
      return (
        <AsyncOptionInitialState
          state={state}
          loadingMessage={loadingMessage}
          onRetry={source.reloadFirstPage}
        />
      );
    }

    return (
      <AsyncOptionList
        options={state.items}
        selectedValues={selectedValues}
        onToggle={handleToggle}
        emptyMessage={emptyMessage}
        onScroll={source.handleScroll}
        footer={
          <AsyncOptionListFooter
            state={state}
            hasMore={source.hasMore}
            onRetry={source.retryLoadMore}
          />
        }
      />
    );
  };

  // ---- レンダリング ----
  return (
    <div className={cn("w-full", className)} {...rest}>
      <PopoverRoot open={resolvedOpen} onOpenChange={handleOpenChange}>
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
          layer="surface-ui"
          onOpenAutoFocus={(e) => {
            // radix の既定（content への focus）を抑止し、CommandInput の autoFocus に委譲
            e.preventDefault();
          }}
          {...popoverContentProps}
          className={cn(
            "w-[min(360px,90vw)] p-0",
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
                    <Span size="sm" tone="muted" align="center" className="block py-6">
                      選択された項目はありません
                    </Span>
                  ) : (
                    <AsyncOptionList
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
                    value={source.searchQuery}
                    onValueChange={source.setSearchQuery}
                    onKeyDown={source.handleSearchKeyDown}
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
      </PopoverRoot>
    </div>
  );
}
