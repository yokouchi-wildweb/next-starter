"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_shadcn/select";
import { serializeOptionValue, type OptionPrimitive } from "@/components/Form/utils";
import { cn } from "@/lib/cn";
import { POPUP_ATTR, CLEAR_VALUE } from "../constants";
import type { SelectEditorProps } from "../types";

export function SelectEditor<T>({
  rawValue,
  column,
  placeholder,
  error,
  textAlignClass,
  popupOpen,
  cellKey,
  onCommit,
  onPopupOpenChange,
  onDraftChange,
}: SelectEditorProps<T>) {
  const allowNullSelection = column.allowNullSelection ?? false;
  const baseSelectValue =
    rawValue === null || typeof rawValue === "undefined"
      ? allowNullSelection
        ? CLEAR_VALUE
        : ""
      : serializeOptionValue(rawValue as OptionPrimitive);

  const selectValue = baseSelectValue === "" ? undefined : baseSelectValue;
  const nullLabel = column.nullOptionLabel ?? "未選択（null）";

  return (
    <Select
      open={popupOpen}
      onOpenChange={onPopupOpenChange}
      value={selectValue}
      onValueChange={(value) => {
        onDraftChange(value);
        const nextValue = allowNullSelection && value === CLEAR_VALUE ? null : value;
        onCommit(nextValue);
      }}
    >
      <SelectTrigger
        className={cn(
          "h-full w-full rounded-none border-0 bg-transparent px-2 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
          error && "border border-destructive",
          textAlignClass,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent {...{ [POPUP_ATTR]: cellKey }}>
        {allowNullSelection ? <SelectItem value={CLEAR_VALUE}>{nullLabel}</SelectItem> : null}
        {(column.options ?? []).map((option, index) => {
          const serializedValue = serializeOptionValue(option.value as OptionPrimitive);
          const key = serializedValue || `option-${index}`;
          return (
            <SelectItem key={key} value={serializedValue}>
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
