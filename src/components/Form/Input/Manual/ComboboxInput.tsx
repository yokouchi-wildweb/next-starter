"use client";

// src/components/Form/Input/Manual/ComboboxInput.tsx

import { type ComponentProps, type HTMLAttributes, useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/_shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/_shadcn/popover";
import { Button } from "@/components/Form/Button/Button";
import {
  resolveOptionSearchText,
  serializeOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { cn } from "@/lib/cn";

export type ComboboxInputProps = {
  /** 現在の値 */
  value?: OptionPrimitive | null;
  /** 値変更コールバック */
  onChange: (value: OptionPrimitive | null) => void;
  /** blur コールバック（ポップオーバー閉じた時に発火） */
  onBlur?: () => void;
  /** 選択肢リスト */
  options?: Options[];
  /** トリガーのプレースホルダー */
  placeholder?: string;
  /** 検索欄のプレースホルダー */
  searchPlaceholder?: string;
  /** 該当なし時のメッセージ */
  emptyMessage?: string;
  /** 無効化 */
  disabled?: boolean;
  /** クリア可能か（選択解除ボタン表示） */
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

export function ComboboxInput({
  value,
  onChange,
  onBlur,
  options = [],
  placeholder = "選択してください",
  searchPlaceholder = "検索...",
  emptyMessage = "該当する項目がありません",
  disabled,
  clearable = false,
  className,
  contentClassName,
  popoverContentProps,
  open,
  onOpenChange,
  ...rest
}: ComboboxInputProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) {
      return;
    }
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    // ポップオーバーが閉じた時に onBlur を発火
    if (!nextOpen) {
      onBlur?.();
    }
  };

  const handleSelect = (optionValue: OptionPrimitive) => {
    onChange(optionValue);
    handleOpenChange(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // 選択中のラベルを取得
  const selectedLabel = useMemo(() => {
    if (value === null || value === undefined) {
      return null;
    }
    const serializedValue = serializeOptionValue(value);
    const found = options.find(
      (opt) => serializeOptionValue(opt.value) === serializedValue
    );
    return found?.label ?? null;
  }, [value, options]);

  const hasValue = selectedLabel !== null;

  return (
    <div className={cn("w-full", className)} {...rest}>
      <Popover open={resolvedOpen} onOpenChange={handleOpenChange}>
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
              {hasValue ? selectedLabel : placeholder}
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
          {...popoverContentProps}
          className={cn(
            "surface-ui-layer w-[--radix-popover-trigger-width] p-0",
            contentClassName,
            popoverContentProps?.className
          )}
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-60">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {options.map((option, index) => {
                const serialized = serializeOptionValue(option.value);
                const key = serialized || `option-${index}`;
                const isSelected =
                  value !== null &&
                  value !== undefined &&
                  serializeOptionValue(value) === serialized;
                const searchValue = resolveOptionSearchText(option);

                return (
                  <CommandItem
                    key={key}
                    value={searchValue}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
