// src/components/Overlays/Popover/ChecklistPopover.tsx

"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useState,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Search, Check, Minus, Plus, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { err } from "@/lib/errors";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Button } from "@/components/Form/Button/Button";
import { type ButtonStyleProps } from "@/components/Form/Button/button-variants";
import { Input } from "@/components/Form/Input/Manual/Input";
import { SwitchInput } from "@/components/Form/Input/Manual/SwitchInput";
import { Checkbox } from "@/components/_shadcn/checkbox";

import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverFooter,
  type PopoverContentProps,
} from "./PopoverPrimitives";

export type ChecklistOption = {
  /** 値（一意） */
  value: string;
  /** 表示ラベル */
  label: string;
  /** 無効化 */
  disabled?: boolean;
  /** 説明文 */
  description?: string;
};

export type ChecklistPopoverProps = {
  /** ポップオーバーを開くトリガー要素 */
  trigger: ReactNode;
  /** タイトル */
  title?: ReactNode;
  /** 説明文 */
  description?: ReactNode;
  /** 選択肢リスト */
  options: ChecklistOption[];
  /** 現在の選択値 */
  value?: string[];
  /** 確認ボタンのラベル */
  confirmLabel?: string;
  /** キャンセルボタンのラベル */
  cancelLabel?: string;
  /**
   * 確認時のコールバック（Promiseを返すと自動でローディング状態になる）。
   * false を返す（resolve する）と閉じず、選択をそのまま残す（失敗時のやり直し用）
   */
  onConfirm?: (values: string[]) => void | boolean | Promise<void | boolean>;
  /** キャンセル時のコールバック */
  onCancel?: () => void;
  /** 確認ボタンのスタイル */
  confirmVariant?: ButtonStyleProps["variant"];
  /** キャンセルボタンのスタイル */
  cancelVariant?: ButtonStyleProps["variant"];
  /** 検索機能を有効にする */
  searchable?: boolean;
  /** 検索プレースホルダー */
  searchPlaceholder?: string;
  /** 全選択/解除ボタンを表示する */
  showSelectAll?: boolean;
  /** 最大選択数（超えると選択不可） */
  maxSelections?: number;
  /** リストの最大高さ（px または CSS値） */
  maxListHeight?: number | string;
  /** 確認後に自動で閉じるか */
  closeOnConfirm?: boolean;
  /** triggerにasChildを適用するか */
  asChild?: boolean;
  /** 制御モード: 開閉状態 */
  open?: boolean;
  /** 制御モード: 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
  /** 選択がないときの表示 */
  emptyMessage?: string;
  /** 検索結果がないときの表示 */
  noResultsMessage?: string;
  /** 「すべて削除」スイッチを表示する */
  showClearAll?: boolean;
  /** 「すべて削除」スイッチのラベル @default "すべて削除" */
  clearAllLabel?: string;
  /**
   * モーダルとして開く（Radix Popover の modal）。開いている間は背面のスクロールと操作を止め、
   * 外側のクリックで閉じる。自身のリストはスクロールできる @default false
   */
  modal?: boolean;
  /**
   * 指定すると検索欄とは別に「新規追加」の入口を表示する。名前を受け取って選択肢を作り、作った選択肢を返す。
   * 作成に成功した選択肢はチェック済みでリストに入る。throw するとエラーを表示し、入力と選択を残す
   */
  onCreateOption?: (name: string) => Promise<ChecklistOption>;
  /** 新規追加の入口のラベル @default "新規追加" */
  createOptionLabel?: string;
  /** 新規追加の入力欄のプレースホルダー @default "名前を入力" */
  createOptionPlaceholder?: string;
  /** 新規追加に失敗したときの既定メッセージ @default "追加に失敗しました" */
  createOptionErrorMessage?: string;
} & Omit<PopoverContentProps, "children" | "title">;

/**
 * チェックリスト選択用ポップオーバー
 * タグ選択、カテゴリ割り当て、フィルター設定などに使用
 *
 * @example
 * // 基本使用
 * <ChecklistPopover
 *   trigger={<Button>タグを選択</Button>}
 *   title="タグを選択"
 *   options={[
 *     { value: "urgent", label: "緊急" },
 *     { value: "important", label: "重要" },
 *     { value: "review", label: "レビュー待ち" },
 *   ]}
 *   value={selectedTags}
 *   onConfirm={async (values) => {
 *     await updateTags(recordId, values);
 *   }}
 * />
 *
 * @example
 * // 検索機能と全選択ボタン付き
 * <ChecklistPopover
 *   trigger={<Button>カテゴリ</Button>}
 *   title="カテゴリを選択"
 *   options={categories}
 *   value={selectedCategories}
 *   searchable
 *   showSelectAll
 *   maxListHeight={240}
 *   onConfirm={handleUpdate}
 * />
 */
export function ChecklistPopover({
  trigger,
  title,
  description,
  options,
  value = [],
  confirmLabel = "適用",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
  cancelVariant = "outline",
  searchable = false,
  searchPlaceholder = "検索...",
  showSelectAll = false,
  maxSelections,
  maxListHeight = 330,
  closeOnConfirm = true,
  asChild = true,
  open: controlledOpen,
  onOpenChange,
  emptyMessage = "選択肢がありません",
  noResultsMessage = "該当する項目がありません",
  showClearAll = false,
  clearAllLabel = "すべて削除",
  modal = false,
  onCreateOption,
  createOptionLabel = "新規追加",
  createOptionPlaceholder = "名前を入力",
  createOptionErrorMessage = "追加に失敗しました",
  // PopoverContent props
  size = "md",
  layer,
  showArrow,
  side,
  sideOffset,
  align,
  alignOffset,
  className,
  onEscapeKeyDown,
  ...contentProps
}: ChecklistPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(value);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClearAll, setIsClearAll] = useState(false);
  const [createdOptions, setCreatedOptions] = useState<ChecklistOption[]>([]);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [focusValue, setFocusValue] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 制御/非制御の判定
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (newOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(newOpen);
      } else {
        setInternalOpen(newOpen);
        onOpenChange?.(newOpen);
      }
    },
    [isControlled, onOpenChange]
  );

  // 開いた時（open の false→true 遷移）にだけ選択状態をリセットする。
  // 旧実装は effect の deps に value（配列）を含めていたため、親の再レンダーで新しい配列が
  // 渡されるたび（SWR 再検証、`value={[]}` のインライン指定、既定値 [] 等）に開いている最中の
  // 選択と検索文字列が消え、既定値の場合は無限に再レンダーしていた
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setSelectedValues(value);
      setSearchQuery("");
      setIsClearAll(false);
      setCreatedOptions([]);
      setIsCreateFormOpen(false);
      setCreateName("");
      setCreateError(null);
    }
  }

  // 作成した選択肢は、親の options に反映されるまでこちらで持つ（反映後は value で重複を除く）
  const allOptions = useMemo(() => {
    const known = new Set(options.map((opt) => opt.value));
    return [...options, ...createdOptions.filter((opt) => !known.has(opt.value))];
  }, [options, createdOptions]);

  // フィルタリングされた選択肢
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return allOptions;
    const query = searchQuery.toLowerCase();
    return allOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.description?.toLowerCase().includes(query)
    );
  }, [allOptions, searchQuery]);

  // 選択可能な選択肢（disabled除外）
  const selectableOptions = useMemo(
    () => filteredOptions.filter((opt) => !opt.disabled),
    [filteredOptions]
  );

  // 全選択状態の判定
  const allSelected = useMemo(
    () =>
      selectableOptions.length > 0 &&
      selectableOptions.every((opt) => selectedValues.includes(opt.value)),
    [selectableOptions, selectedValues]
  );

  const someSelected = useMemo(
    () =>
      selectableOptions.some((opt) => selectedValues.includes(opt.value)) &&
      !allSelected,
    [selectableOptions, selectedValues, allSelected]
  );

  // 最大選択数に達しているか
  const isMaxReached = useMemo(
    () => maxSelections !== undefined && selectedValues.length >= maxSelections,
    [maxSelections, selectedValues]
  );

  const handleToggle = useCallback(
    (optionValue: string, checked: boolean) => {
      setSelectedValues((prev) => {
        if (checked) {
          // 最大選択数チェック
          if (maxSelections !== undefined && prev.length >= maxSelections) {
            return prev;
          }
          return [...prev, optionValue];
        }
        return prev.filter((v) => v !== optionValue);
      });
    },
    [maxSelections]
  );

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      // 全解除（フィルタリングされた選択肢のみ）
      setSelectedValues((prev) =>
        prev.filter((v) => !selectableOptions.some((opt) => opt.value === v))
      );
    } else {
      // 全選択（フィルタリングされた選択肢のみ、最大選択数を考慮）
      const newValues = new Set(selectedValues);
      for (const opt of selectableOptions) {
        if (maxSelections !== undefined && newValues.size >= maxSelections) break;
        newValues.add(opt.value);
      }
      setSelectedValues(Array.from(newValues));
    }
  }, [allSelected, selectableOptions, selectedValues, maxSelections]);

  const handleConfirm = useCallback(async () => {
    if (!onConfirm) {
      if (closeOnConfirm) setOpen(false);
      return;
    }

    const valuesToSend = isClearAll ? [] : selectedValues;
    const result = onConfirm(valuesToSend);

    if (result instanceof Promise) {
      setIsLoading(true);
      try {
        const resolved = await result;
        if (closeOnConfirm && resolved !== false) setOpen(false);
      } finally {
        setIsLoading(false);
      }
    } else {
      if (closeOnConfirm && result !== false) setOpen(false);
    }
  }, [onConfirm, selectedValues, isClearAll, closeOnConfirm, setOpen]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    setOpen(false);
  }, [onCancel, setOpen]);

  const { execute: submitCreate, isExecuting: isCreating } = useAsyncAction(async () => {
    const name = createName.trim();
    if (!name || !onCreateOption) return;

    setCreateError(null);
    // 同じ名前があれば作らずにそれを選ぶ（名前の一意制約が無い関連先で重複を増やさない）
    const existing = allOptions.find((opt) => opt.label.trim() === name);
    if (existing?.disabled) {
      setCreateError(`「${name}」は選択できません`);
      return;
    }
    try {
      const option = existing ?? (await onCreateOption(name));
      if (!existing) setCreatedOptions((prev) => [...prev, option]);
      if (!selectedValues.includes(option.value)) handleToggle(option.value, true);
      // 検索中でも作った項目が絞り込みで隠れないようにする
      setSearchQuery("");
      setCreateName("");
      setIsCreateFormOpen(false);
      setFocusValue(option.value);
    } catch (error) {
      setCreateError(err(error, createOptionErrorMessage));
    }
  });

  const closeCreateForm = useCallback(() => {
    setIsCreateFormOpen(false);
    setCreateName("");
    setCreateError(null);
  }, []);

  const handleCreateKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    // IME の変換確定の Enter では送らない。外側のフォームも送信させない
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    void submitCreate();
  };

  // 入力欄が開いている間の Esc は入力欄だけを閉じる（ポップオーバーは閉じない）
  const handleEscapeKeyDown = (event: KeyboardEvent) => {
    if (isCreateFormOpen) {
      event.preventDefault();
      if (!event.isComposing && !isCreating) closeCreateForm();
      return;
    }
    onEscapeKeyDown?.(event);
  };

  // 作成した項目へスクロールしフォーカスを移す。入力欄が消えた直後に行うので commit と同じタイミングにする
  useLayoutEffect(() => {
    if (focusValue === null) return;
    const row = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-option-value]") ?? []
    ).find((el) => el.dataset.optionValue === focusValue);
    row?.scrollIntoView({ block: "nearest" });
    row?.querySelector<HTMLElement>('[role="checkbox"]')?.focus();
    setFocusValue(null);
  }, [focusValue]);

  // リストの高さスタイル
  const listStyle = useMemo(() => {
    if (!maxListHeight) return undefined;
    const height =
      typeof maxListHeight === "number" ? `${maxListHeight}px` : maxListHeight;
    return { maxHeight: height };
  }, [maxListHeight]);

  // 変更があるかどうか
  const hasChanges = useMemo(() => {
    if (isClearAll) return true;
    if (selectedValues.length !== value.length) return true;
    return !selectedValues.every((v) => value.includes(v));
  }, [selectedValues, value, isClearAll]);

  return (
    <PopoverRoot open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild={asChild}>{trigger}</PopoverTrigger>
      <PopoverContent
        size={size}
        layer={layer}
        showArrow={showArrow}
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className={cn("p-0", className)}
        onEscapeKeyDown={handleEscapeKeyDown}
        {...contentProps}
      >
        {/* ヘッダー */}
        {(title || description) && (
          <PopoverHeader className="border-b px-3 py-2">
            {title && <PopoverTitle>{title}</PopoverTitle>}
            {description && (
              <PopoverDescription>{description}</PopoverDescription>
            )}
          </PopoverHeader>
        )}

        {/* 検索 */}
        {searchable && (
          <div className="border-b px-3 py-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              leftIcon={<Search className="size-4" />}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* 全選択ボタン */}
        {showSelectAll && selectableOptions.length > 0 && (
          <div className="border-b px-3 py-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm",
                "hover:bg-accent hover:text-accent-foreground transition-colors"
              )}
            >
              <div
                className={cn(
                  "flex size-4 items-center justify-center rounded-sm border",
                  allSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : someSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                )}
              >
                {allSelected && <Check className="size-3" />}
                {someSelected && <Minus className="size-3" />}
              </div>
              <span>
                {allSelected ? "すべて解除" : "すべて選択"}
                {maxSelections && ` (最大${maxSelections}件)`}
              </span>
            </button>
          </div>
        )}

        {/* すべて削除スイッチ */}
        {showClearAll && (
          <div className="border-b px-3 py-2">
            <SwitchInput
              value={isClearAll}
              onChange={setIsClearAll}
              label={clearAllLabel}
              activeColor="destructive"
            />
          </div>
        )}

        {/* チェックリスト */}
        <div ref={listRef} className={cn("overflow-y-auto", isClearAll && "pointer-events-none opacity-40")} style={listStyle}>
          {allOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {noResultsMessage}
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                const isDisabledByMax = !isSelected && isMaxReached;

                return (
                  <label
                    key={option.value}
                    data-option-value={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5",
                      "hover:bg-accent hover:text-accent-foreground transition-colors",
                      (option.disabled || isDisabledByMax) &&
                        "cursor-not-allowed opacity-50"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleToggle(option.value, Boolean(checked))
                      }
                      disabled={option.disabled || isDisabledByMax}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* 新規追加 */}
        {onCreateOption && !isClearAll && (
          <div className="border-t px-3 py-2">
            {isCreateFormOpen ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={createName}
                    onChange={(e) => {
                      setCreateName(e.target.value);
                      setCreateError(null);
                    }}
                    onKeyDown={handleCreateKeyDown}
                    placeholder={createOptionPlaceholder}
                    disabled={isCreating}
                    aria-invalid={createError !== null}
                    className="h-8 min-w-0 flex-1 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void submitCreate()}
                    disabled={isCreating || !createName.trim()}
                  >
                    {isCreating ? "追加中..." : "追加"}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="mutedIcon"
                    onClick={closeCreateForm}
                    disabled={isCreating}
                  >
                    <X className="size-4" />
                    <span className="sr-only">新規追加をやめる</span>
                  </Button>
                </div>
                {createError && (
                  <div role="alert" className="text-xs text-destructive-text">
                    {createError}
                  </div>
                )}
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setIsCreateFormOpen(true)}
                disabled={isMaxReached}
              >
                <Plus className="size-4" />
                {createOptionLabel}
              </Button>
            )}
          </div>
        )}

        {/* 選択数表示 */}
        {maxSelections && (
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            {selectedValues.length} / {maxSelections} 件選択中
          </div>
        )}

        {/* フッター */}
        <PopoverFooter className="border-t px-3 py-2">
          <Button
            size="sm"
            variant={cancelVariant}
            onClick={handleCancel}
            disabled={isLoading || isCreating}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isLoading || isCreating || !hasChanges}
          >
            {isLoading ? "処理中..." : confirmLabel}
          </Button>
        </PopoverFooter>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default ChecklistPopover;
