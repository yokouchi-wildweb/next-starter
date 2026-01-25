"use client";

import React from "react";
import { SwitchInput as ManualSwitchInput } from "@/components/Form/Input/Manual/SwitchInput";
import { cn } from "@/lib/cn";
import type { SwitchEditorProps } from "../types";

export function SwitchEditor<T>({
  rowKey,
  column,
  switchValue,
  paddingClass,
  onToggle,
}: SwitchEditorProps<T>) {
  return (
    <div data-cell-editor data-editor-type="switch" className={cn("h-full flex items-center justify-center", paddingClass)}>
      <ManualSwitchInput
        value={switchValue}
        name={`${String(rowKey)}-${column.field}`}
        onChange={(checked: boolean) => onToggle(checked)}
        aria-label={`${column.header}の切り替え`}
        activeColor="primary"
      />
    </div>
  );
}
