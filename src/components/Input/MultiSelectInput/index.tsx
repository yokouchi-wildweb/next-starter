"use client";

// src/components/Input/MultiSelectInput/index.tsx

import { type ComponentProps, type HTMLAttributes, type MouseEvent, useState } from "react";

import { Command } from "@/components/Primitives/Command";
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "@/components/Primitives/Popover";
import { Button } from "@/components/Button/Button";
import {
  normalizeOptionValues,
  toggleOptionValue,
  type OptionPrimitive,
} from "@/components/Input/options";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { cn } from "@/lib/cn";
import { type Options } from "@/components/Input/options";

import { PICKER_POPOVER_BODY_CLASS, usePickerPopoverSide } from "@/components/Input/AsyncOptionSource";

import { MultiSelectOptionList } from "./MultiSelectOptionList";
import { MultiSelectSearchSection } from "./MultiSelectSearchSection";
import type { InputSize } from "@/lib/variantOverrides";
import { MultiSelectTrigger } from "./MultiSelectTrigger";

/** AsyncMultiSelectInput も同じトリガーを使う(このフォルダの外は入口から読む) */
export { MultiSelectTrigger };

/** 縮めずに出したい中身の高さ（検索欄 + 候補リスト max-h-60 + 確定ボタン行） */
const PREFERRED_POPOVER_HEIGHT = 330;

export type MultiSelectInputProps = {
  /** 現在の値（選択されている値の配列） */
  value?: OptionPrimitive[] | null;
  /** フィールド名 */
  name?: string;
  /** 値が変更されたときのコールバック */
  onChange: (value: OptionPrimitive[]) => void;
  /** フォーカスが外れたときのコールバック（ポップオーバーが閉じた時に発火） */
  onBlur?: () => void;
  options?: Options[];
  placeholder?: string;
  emptyMessage?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  popoverContentProps?: ComponentProps<typeof PopoverContent>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** トリガーボタンに適用するクラス名 */
  triggerClassName?: string;
  /** 引き金の高さの段(入力欄・ボタンの size と同じ名前・同じ高さ)@default "md" */
  size?: InputSize;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange">;

export function MultiSelectInput({
  value,
  name,
  onChange,
  onBlur,
  options = [],
  placeholder = "選択してください",
  emptyMessage = "該当する項目がありません",
  enableSearch = true,
  searchPlaceholder,
  disabled,
  className,
  popoverContentProps,
  open,
  onOpenChange,
  triggerClassName,
  size = "md",
  id,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
  ...rest
}: MultiSelectInputProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;
  const { side, anchorRef, measure } = usePickerPopoverSide(PREFERRED_POPOVER_HEIGHT);

  const selectedValues = normalizeOptionValues(value);
  const selectedCount = selectedValues.length;

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) {
      return;
    }
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    // 下の空きが足りず上の方が広ければ上へ開く（AsyncOptionSource/popoverSide.ts）
    if (nextOpen) {
      measure();
    }
    // ポップオーバーが閉じた時にonBlurを発火
    if (!nextOpen) {
      onBlur?.();
    }
  };

  const handleToggle = (optionValue: OptionPrimitive) => {
    onChange(toggleOptionValue(selectedValues, optionValue));
  };

  const handleClosePicker = () => {
    handleOpenChange(false);
  };

  return (
    <div ref={anchorRef} className={cn("w-full", className)} {...rest}>
      <PopoverRoot open={resolvedOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <MultiSelectTrigger
            id={id}
            aria-describedby={ariaDescribedby}
            aria-invalid={ariaInvalid}
            placeholder={placeholder}
            selectedCount={selectedCount}
            open={resolvedOpen}
            disabled={disabled}
            size={size}
            className={triggerClassName}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side={side}
          {...popoverContentProps}
          className={cn(
            "w-[min(320px,90vw)] p-0",
            popoverContentProps?.className
          )}
        >
          {/* スクロール領域は候補リストだけ: 上限を中身のルートに付け、flex-col + min-h-0 でリストを縮める */}
          <Stack gap="none" padding="none" className={PICKER_POPOVER_BODY_CLASS}>
            <Command className="min-h-0">
              {enableSearch && <MultiSelectSearchSection placeholder={searchPlaceholder} />}
              <MultiSelectOptionList
                options={options}
                selectedValues={selectedValues}
                onToggle={handleToggle}
                emptyMessage={emptyMessage}
              />
            </Command>
            <Flex
              padding="xs"
              justify="end"
              className="shrink-0 border-t border-border bg-popover"
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
