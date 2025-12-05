"use client";

import React from "react";
import { serializeOptionValue, type OptionPrimitive } from "@/components/Form/utils";
import { cn } from "@/lib/cn";
import type { EditableGridColumn } from "../../../types";

type CellDisplayProps<T> = {
  rawValue: unknown;
  baseValue: string | null;
  row: T;
  column: EditableGridColumn<T>;
  fallbackPlaceholder: string;
  className?: string;
  isReadOnly?: boolean;
  flexAlignClass?: string;
  paddingClass: string;
};

export function CellDisplay<T>({
  rawValue,
  baseValue,
  row,
  column,
  fallbackPlaceholder,
  className,
  isReadOnly,
  flexAlignClass,
  paddingClass,
}: CellDisplayProps<T>) {
  const displayValue = React.useMemo(() => {
    // カスタム表示関数がある場合
    if (column.renderDisplay) {
      return column.renderDisplay(rawValue, row);
    }

    // select型の表示処理
    if (column.editorType === "select") {
      if ((rawValue === null || typeof rawValue === "undefined") && column.allowNullSelection) {
        return column.nullOptionLabel ?? fallbackPlaceholder;
      }
      if (column.options) {
        const serializedRaw = serializeOptionValue(rawValue as OptionPrimitive | null | undefined);
        const option = column.options.find(
          (op) => serializeOptionValue(op.value as OptionPrimitive) === serializedRaw,
        );
        if (option) {
          return option.label;
        }
      }
    }

    // multi-select型の表示処理
    if (column.editorType === "multi-select" && column.options) {
      const values = Array.isArray(rawValue) ? (rawValue as OptionPrimitive[]) : [];
      if (values.length === 0) {
        return fallbackPlaceholder;
      }
      const labels = values.map((entry) => {
        const serializedValue = serializeOptionValue(entry);
        const match = column.options?.find(
          (op) => serializeOptionValue(op.value as OptionPrimitive) === serializedValue,
        );
        return match?.label ?? serializedValue;
      });
      return labels.join(", ");
    }

    // multi-select型でoptionsがない場合
    if (column.editorType === "multi-select" && Array.isArray(rawValue)) {
      return rawValue.map((entry) => String(entry)).join(", ") || fallbackPlaceholder;
    }

    // デフォルト表示
    return baseValue || fallbackPlaceholder;
  }, [baseValue, column, fallbackPlaceholder, rawValue, row]);

  return (
    <div
      className={cn(
        "w-full px-2.5 text-sm flex items-center text-foreground truncate",
        isReadOnly && "bg-muted/50 text-muted-foreground",
        flexAlignClass,
        paddingClass,
        className,
      )}
    >
      {displayValue}
    </div>
  );
}
