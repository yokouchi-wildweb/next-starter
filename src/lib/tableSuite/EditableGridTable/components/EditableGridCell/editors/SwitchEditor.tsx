"use client";

import React from "react";
import { SwitchInput as ManualSwitchInput } from "@/components/Form/Input/Manual/SwitchInput";
import { cn } from "@/lib/cn";
import { Flex } from "@/components/Layout/Flex";
import type { SwitchEditorProps } from "../types";

export function SwitchEditor<T>({
  rowKey,
  column,
  switchValue,
  paddingClass,
  onToggle,
}: SwitchEditorProps<T>) {
  return (
    <Flex data-cell-editor data-editor-type="switch" align="center" justify="center" className={cn("h-full", paddingClass)}>
      <ManualSwitchInput
        value={switchValue}
        name={`${String(rowKey)}-${column.field}`}
        onChange={(checked: boolean) => onToggle(checked)}
        aria-label={`${column.header}の切り替え`}
        activeColor="primary"
      />
    </Flex>
  );
}
