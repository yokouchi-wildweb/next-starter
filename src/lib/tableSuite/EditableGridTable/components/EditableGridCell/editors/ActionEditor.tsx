"use client";

import React from "react";
import { TableCellAction } from "@/lib/tableSuite/shared";
import { cn } from "@/lib/cn";
import type { ActionEditorProps } from "../types";

export function ActionEditor<T>({
  row,
  column,
  fallbackPlaceholder,
  flexAlignClass,
  paddingClass,
}: ActionEditorProps<T>) {
  if (!column.renderAction) {
    return (
      <div
        data-cell-editor
        data-editor-type="action"
        className={cn(
          "w-full h-full text-sm flex items-center text-foreground truncate text-muted-foreground",
          flexAlignClass,
          paddingClass,
        )}
      >
        {fallbackPlaceholder}
      </div>
    );
  }

  return (
    <TableCellAction data-cell-editor data-editor-type="action" className={cn("w-full h-full", flexAlignClass, paddingClass)}>
      {column.renderAction(row)}
    </TableCellAction>
  );
}
