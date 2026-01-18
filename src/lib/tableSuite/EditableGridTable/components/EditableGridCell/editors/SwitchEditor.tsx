"use client";

import React from "react";
import { SwitchInput as ManualSwitchInput } from "@/components/Form/Input/Manual/SwitchInput";
import type { SwitchEditorProps } from "../types";

export function SwitchEditor<T>({
  rowKey,
  column,
  switchValue,
  onToggle,
}: SwitchEditorProps<T>) {
  return (
    <div className="px-2 py-1">
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
