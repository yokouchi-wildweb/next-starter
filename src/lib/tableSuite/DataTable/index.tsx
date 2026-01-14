// src/components/Tables/DataTable/index.tsx

"use client";

import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./components";
import { cn } from "@/lib/cn";
import type { TableColumnAlignment, TableStylingProps } from "../types";
import { resolveColumnTextAlignClass, resolveRowClassName } from "../types";

export type DataTableColumn<T> = {
  header: string;
  render: (item: T) => React.ReactNode;
  align?: TableColumnAlignment;
};

export type RowCursor = "pointer" | "default" | "zoom-in" | "grab";

export type DataTableProps<T> = TableStylingProps<T> & {
  /**
   * Data rows to render. Optional to allow callers to omit until data is loaded
   * without causing runtime errors.
   */
  items?: T[];
  columns: DataTableColumn<T>[];
  getKey?: (item: T, index: number) => React.Key;
  onRowClick?: (item: T) => void;
  /**
   * onRowClick が設定されている場合のホバー時カーソル
   * @default "pointer"
   */
  rowCursor?: RowCursor;
  emptyValueFallback?: string;
};

const ROW_CURSOR_CLASS: Record<RowCursor, string> = {
  pointer: "cursor-pointer",
  default: "cursor-default",
  "zoom-in": "cursor-zoom-in",
  grab: "cursor-grab",
};

export default function DataTable<T>({
  items = [],
  columns,
  getKey = (_, i) => i,
  className,
  maxHeight,
  rowClassName,
  onRowClick,
  rowCursor = "pointer",
  emptyValueFallback,
  scrollContainerRef,
  bottomSentinelRef,
}: DataTableProps<T>) {
  const resolvedFallback = emptyValueFallback ?? "(未設定)";
  const renderCellContent = (content: React.ReactNode) => {
    if (content) {
      return content;
    }
    return (
      <span className="text-muted-foreground text-xs font-medium">{resolvedFallback}</span>
    );
  };

  const resolvedMaxHeight = maxHeight ?? "70vh";

  return (
    <div
      className={cn("overflow-x-auto overflow-y-auto", className)}
      style={{ maxHeight: resolvedMaxHeight }}
      ref={scrollContainerRef}
    >
      <Table variant="list">
        <TableHeader>
          <TableRow disableHover>
            {columns.map((col, idx) => (
              <TableHead key={idx} className={resolveColumnTextAlignClass(col.align)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow
              key={getKey(item, index)}
              className={cn(
                "group",
                onRowClick && ROW_CURSOR_CLASS[rowCursor],
                resolveRowClassName(rowClassName, item, { index }),
              )}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col, idx) => (
                <TableCell key={idx} className={resolveColumnTextAlignClass(col.align)}>
                  {renderCellContent(col.render(item))}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {bottomSentinelRef ? (
        <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
      ) : null}
    </div>
  );
}

export * from "./components";
