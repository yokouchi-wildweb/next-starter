// src/components/Overlays/Popover/SelectPopover.tsx

"use client";

import { type ReactNode, useState, useCallback, useMemo, useEffect } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/Form/Button/Button";
import { type ButtonStyleProps } from "@/components/Form/Button/button-variants";
import { Input } from "@/components/Form/Input/Manual/Input";
import { RadioGroup, RadioGroupItem } from "@/components/_shadcn/radio-group";

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

export type SelectOption = {
  /** 値（一意） */
  value: string;
  /** 表示ラベル */
  label: string;
  /** 無効化 */
  disabled?: boolean;
  /** 説明文 */
  description?: string;
};

export type SelectPopoverProps = {
  /** ポップオーバーを開くトリガー要素 */
  trigger: ReactNode;
  /** タイトル */
  title?: ReactNode;
  /** 説明文 */
  description?: ReactNode;
  /** 選択肢リスト */
  options: SelectOption[];
  /** 現在の選択値 */
  value?: string;
  /** 確認ボタンのラベル */
  confirmLabel?: string;
  /** キャンセルボタンのラベル */
  cancelLabel?: string;
  /** 確認時のコールバック（Promiseを返すと自動でローディング状態になる） */
  onConfirm?: (value: string) => void | Promise<void>;
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
 * 単一選択用ポップオーバー（ラジオボタン形式）
 * enumフィールドの変更、ステータス変更などに使用
 *
 * @example
 * // 基本使用
 * <SelectPopover
 *   trigger={<Button>ステータスを変更</Button>}
 *   title="ステータスを選択"
 *   options={[
 *     { value: "draft", label: "下書き" },
 *     { value: "published", label: "公開中" },
 *     { value: "archived", label: "アーカイブ" },
 *   ]}
 *   value={currentStatus}
 *   onConfirm={async (value) => {
 *     await updateStatus(recordId, value);
 *   }}
 * />
 *
 * @example
 * // 検索機能付き
 * <SelectPopover
 *   trigger={<Button>カテゴリ</Button>}
 *   title="カテゴリを選択"
 *   options={categories}
 *   value={currentCategory}
 *   searchable
 *   maxListHeight={240}
 *   onConfirm={handleUpdate}
 * />
 */
export function SelectPopover({
  trigger,
  title,
  description,
  options,
  value,
  confirmLabel = "適用",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
  cancelVariant = "outline",
  searchable = false,
  searchPlaceholder = "検索...",
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
}: SelectPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | undefined>(value);
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
      setSelectedValue(value);
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

  // リストの高さスタイル
  const listStyle = useMemo(() => {
    if (!maxListHeight) return undefined;
    const height =
      typeof maxListHeight === "number" ? `${maxListHeight}px` : maxListHeight;
    return { maxHeight: height };
  }, [maxListHeight]);

  const handleConfirm = useCallback(async () => {
    if (selectedValue === undefined) return;

    if (!onConfirm) {
      if (closeOnConfirm) setOpen(false);
      return;
    }

    const result = onConfirm(selectedValue);

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
  }, [onConfirm, selectedValue, closeOnConfirm, setOpen]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    setOpen(false);
  }, [onCancel, setOpen]);

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

        {/* ラジオリスト */}
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
            <RadioGroup
              value={selectedValue}
              onValueChange={setSelectedValue}
              className="p-1 gap-0"
            >
              {filteredOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5",
                    "hover:bg-accent hover:text-accent-foreground transition-colors",
                    option.disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <RadioGroupItem
                    value={option.value}
                    disabled={option.disabled}
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
              ))}
            </RadioGroup>
          )}
        </div>

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
            disabled={isLoading}
          >
            {isLoading ? "処理中..." : confirmLabel}
          </Button>
        </PopoverFooter>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default SelectPopover;
