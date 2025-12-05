"use client";

import React from "react";
import { TableCellAction } from "@/lib/tableSuite/DataTable/components";
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
        className={cn(
          "w-full px-2.5 text-sm flex items-center text-foreground truncate text-muted-foreground",
          flexAlignClass,
          paddingClass,
        )}
      >
        {fallbackPlaceholder}
      </div>
    );
  }

  return (
    <TableCellAction className={cn("w-full px-2", flexAlignClass, paddingClass)}>
      {column.renderAction(row)}
    </TableCellAction>
  );
}
