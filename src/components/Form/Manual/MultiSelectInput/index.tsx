"use client";

// src/components/Form/Manual/MultiSelectInput/index.tsx

import { type ComponentProps, type HTMLAttributes, type MouseEvent, useState } from "react";

import { Command } from "@/components/_shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/_shadcn/popover";
import { Button } from "@/components/Form/Button/Button";
import {
  normalizeOptionValues,
  toggleOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { cn } from "@/lib/cn";
import { type Options } from "@/types/form";

import { MultiSelectOptionList } from "./MultiSelectOptionList";
import { MultiSelectSearchSection } from "./MultiSelectSearchSection";
import { MultiSelectTrigger } from "./MultiSelectTrigger";

type FieldProp = {
  value?: OptionPrimitive[] | null;
  onChange: (value: OptionPrimitive[]) => void;
  name?: string;
};

export type MultiSelectInputProps = {
  field: FieldProp;
  options?: Options[];
  placeholder?: string;
  emptyMessage?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  popoverContentProps?: ComponentProps<typeof PopoverContent>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange">;

export function MultiSelectInput({
  field,
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
  ...rest
}: MultiSelectInputProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  const selectedValues = normalizeOptionValues(field.value);
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

  const handleToggle = (value: OptionPrimitive) => {
    field.onChange(toggleOptionValue(selectedValues, value));
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
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          {...popoverContentProps}
          className={cn("w-[min(320px,90vw)] p-0", popoverContentProps?.className)}
        >
          <Block space="none" padding="none">
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
          </Block>
        </PopoverContent>
      </Popover>
    </div>
  );
}
