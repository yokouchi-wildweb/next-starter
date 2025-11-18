// src/components/DataTable/DataTable.tsx

"use client";

import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./Table";
import { cn } from "@/lib/cn";

export type DataTableColumn<T> = {
  header: string;
  render: (item: T) => React.ReactNode;
};

export type DataTableProps<T> = {
  /**
   * Data rows to render. Optional to allow callers to omit until data is loaded
   * without causing runtime errors.
   */
  items?: T[];
  columns: DataTableColumn<T>[];
  getKey?: (item: T, index: number) => React.Key;
  rowClassName?: string;
  onRowClick?: (item: T) => void;
  emptyValueFallback?: string;
};

export default function DataTable<T>({
  items = [],
  columns,
  getKey = (_, i) => i,
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
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
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
              className={cn("group", rowClassName)}
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
