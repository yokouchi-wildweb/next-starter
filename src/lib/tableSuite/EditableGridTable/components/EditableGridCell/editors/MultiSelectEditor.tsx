"use client";

import React from "react";
import { MultiSelectInput } from "@/components/Form/Input/Manual/MultiSelectInput";
import type { MultiSelectInputProps } from "@/components/Form/Input/Manual/MultiSelectInput";
import { normalizeOptionValues, type OptionPrimitive } from "@/components/Form/utils";
import { cn } from "@/lib/cn";
import { POPUP_ATTR } from "../constants";
import type { SelectEditorProps } from "../types";

export function MultiSelectEditor<T>({
  rawValue,
  rowKey,
  column,
  placeholder,
  paddingClass,
  popupOpen,
  cellKey,
  onPopupOpenChange,
  onCommit,
}: Omit<SelectEditorProps<T>, "onDraftChange" | "textAlignClass" | "error">) {
  const normalizedMultiValue = React.useMemo(() => {
    return normalizeOptionValues((rawValue as OptionPrimitive[] | null) ?? null);
  }, [rawValue]);

  const handleMultiSelectChange = React.useCallback(
    (values: OptionPrimitive[]) => {
      onCommit(values, { keepEditing: true, skipDraftReset: true });
    },
    [onCommit],
  );

  const fieldName = `${String(rowKey)}-${column.field}`;

  return (
    <MultiSelectInput
      data-cell-editor
      data-editor-type="multi-select"
      value={normalizedMultiValue}
      name={fieldName}
      onChange={handleMultiSelectChange}
      options={column.options ?? []}
      placeholder={placeholder}
      open={popupOpen}
      onOpenChange={onPopupOpenChange}
      popoverContentProps={
        {
          [POPUP_ATTR]: cellKey,
        } as MultiSelectInputProps["popoverContentProps"]
      }
      className="h-full w-full"
      triggerClassName={cn(
        "h-full w-full rounded-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
        paddingClass,
      )}
    />
  );
}
