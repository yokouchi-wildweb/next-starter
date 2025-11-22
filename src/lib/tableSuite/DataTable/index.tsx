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
import type { TableStylingProps } from "../types";
import { resolveRowClassName } from "../types";

export type DataTableColumn<T> = {
  header: string;
  render: (item: T) => React.ReactNode;
};

export type DataTableProps<T> = TableStylingProps<T> & {
  /**
   * Data rows to render. Optional to allow callers to omit until data is loaded
   * without causing runtime errors.
   */
  items?: T[];
  columns: DataTableColumn<T>[];
  getKey?: (item: T, index: number) => React.Key;
  onRowClick?: (item: T) => void;
  emptyValueFallback?: string;
};

export default function DataTable<T>({
  items = [],
  columns,
  getKey = (_, i) => i,
  className,
  rowClassName,
  onRowClick,
  emptyValueFallback,
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

  return (
    <div className={cn("overflow-x-auto overflow-y-auto max-h-[70vh]", className)}>
      <Table variant="list">
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead key={idx}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow
              key={getKey(item, index)}
              className={cn("group", resolveRowClassName(rowClassName, item, { index }))}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col, idx) => (
                <TableCell key={idx}>{renderCellContent(col.render(item))}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export * from "./components";
