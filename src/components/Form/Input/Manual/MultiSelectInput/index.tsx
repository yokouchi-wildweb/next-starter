"use client";

// @/components/Form/Input/Manual/MultiSelectInput/index.tsx

import { type ComponentProps, type HTMLAttributes, type MouseEvent, useState } from "react";

import { Command } from "@/components/_shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/_shadcn/popover";
import { Button } from "@/components/Form/Button/Button";
import {
  normalizeOptionValues,
  toggleOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { cn } from "@/lib/cn";
import { type Options } from "@/components/Form/types";

import { MultiSelectOptionList } from "./MultiSelectOptionList";
import { MultiSelectSearchSection } from "./MultiSelectSearchSection";
import { MultiSelectTrigger } from "./MultiSelectTrigger";

export type MultiSelectInputProps = {
  /** 現在の値（選択されている値の配列） */
  value?: OptionPrimitive[] | null;
  /** フィールド名 */
  name?: string;
  /** 値が変更されたときのコールバック */
  onChange: (value: OptionPrimitive[]) => void;
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
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange">;

export function MultiSelectInput({
  value,
  name,
  onChange,
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
  ...rest
}: MultiSelectInputProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

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
  };

  const handleToggle = (optionValue: OptionPrimitive) => {
    onChange(toggleOptionValue(selectedValues, optionValue));
  };

  const handleClosePicker = () => {
    handleOpenChange(false);
  };

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
          {...popoverContentProps}
          className={cn(
            "surface-ui-layer w-[min(320px,90vw)] p-0",
            popoverContentProps?.className
          )}
        >
          <Stack space={0} padding="none">
            <Command>
              {enableSearch && <MultiSelectSearchSection placeholder={searchPlaceholder} />}
              <MultiSelectOptionList
                options={options}
                selectedValues={selectedValues}
                onToggle={handleToggle}
                emptyMessage={emptyMessage}
              />
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
