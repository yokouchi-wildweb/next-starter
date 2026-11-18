"use client";

import React from "react";
import { TableCellAction } from "../../../../shared";
import { cn } from "@/lib/cn";
import { Flex } from "@/components/Layout/Flex";
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
      <Flex
        data-cell-editor
        data-editor-type="action"
        align="center"
        className={cn(
          "w-full h-full text-sm text-foreground truncate text-muted-foreground",
          flexAlignClass,
          paddingClass,
        )}
      >
        {fallbackPlaceholder}
      </Flex>
    );
  }

  return (
    <TableCellAction data-cell-editor data-editor-type="action" className={cn("w-full h-full", flexAlignClass, paddingClass)}>
      {column.renderAction(row)}
    </TableCellAction>
  );
}
