// src/components/Overlays/Popover/ChecklistPopover.tsx

"use client";

import { type ReactNode, useState, useCallback, useMemo, useEffect } from "react";
import { Search, Check, Minus } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/Form/Button/Button";
import { type ButtonStyleProps } from "@/components/Form/Button/button-variants";
import { Input } from "@/components/Form/Input/Manual/Input";
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
  /** 確認時のコールバック（Promiseを返すと自動でローディング状態になる） */
  onConfirm?: (values: string[]) => void | Promise<void>;
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
} & Omit<PopoverContentProps, "children">;

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
  maxListHeight = 280,
  closeOnConfirm = true,
  asChild = true,
  open: controlledOpen,
  onOpenChange,
  emptyMessage = "選択肢がありません",
  noResultsMessage = "該当する項目がありません",
  // PopoverContent props
  size = "md",
  layer,
  showArrow,
  side,
  sideOffset,
  align,
  alignOffset,
  className,
  ...contentProps
}: ChecklistPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(value);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  // 開いた時に選択状態をリセット
  useEffect(() => {
    if (open) {
      setSelectedValues(value);
      setSearchQuery("");
    }
  }, [open, value]);

  // フィルタリングされた選択肢
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.description?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

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

    const result = onConfirm(selectedValues);

    if (result instanceof Promise) {
      setIsLoading(true);
      try {
        await result;
        if (closeOnConfirm) setOpen(false);
      } finally {
        setIsLoading(false);
      }
    } else {
      if (closeOnConfirm) setOpen(false);
    }
  }, [onConfirm, selectedValues, closeOnConfirm, setOpen]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    setOpen(false);
  }, [onCancel, setOpen]);

  // リストの高さスタイル
  const listStyle = useMemo(() => {
    if (!maxListHeight) return undefined;
    const height =
      typeof maxListHeight === "number" ? `${maxListHeight}px` : maxListHeight;
    return { maxHeight: height };
  }, [maxListHeight]);

  // 変更があるかどうか
  const hasChanges = useMemo(() => {
    if (selectedValues.length !== value.length) return true;
    return !selectedValues.every((v) => value.includes(v));
  }, [selectedValues, value]);

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
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

        {/* チェックリスト */}
        <div className="overflow-y-auto" style={listStyle}>
          {options.length === 0 ? (
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
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isLoading || !hasChanges}
          >
            {isLoading ? "処理中..." : confirmLabel}
          </Button>
        </PopoverFooter>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default ChecklistPopover;
