// src/lib/tableSuite/EditableGridTable/index.tsx

"use client";

import React from "react";

import { cn } from "@/lib/cn";

import {
  Table,
  TableBody,
  TableHeader,
  TableHead,
  TableRow,
} from "../DataTable/components";
import { resolveRowClassName } from "../types";
import type { EditableGridColumn, EditableGridTableProps } from "./types";
import { EditableGridCell } from "./components/EditableGridCell";
import { normalizeOrderRules, compareRows } from "./utils/sort";

type KeyedRow<T> = {
  row: T;
  rowKey: React.Key;
  rowIndex: number;
};

export default function EditableGridTable<T>({
  items = [],
  columns,
  getKey = (_, index) => index,
  className,
  rowClassName,
  onCellChange,
  emptyValueFallback = "(未設定)",
  tableLayout = "auto",
  autoSort = false,
  order,
  rowHeight = "md",
}: EditableGridTableProps<T>) {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" && autoSort && (!order || order.length === 0)) {
      console.warn("EditableGridTable: autoSort を有効にする場合は order を指定してください。");
    }
  }, [autoSort, order]);

  const keyedRows = React.useMemo<KeyedRow<T>[]>(
    () =>
      items.map((row, rowIndex) => ({
        row,
        rowIndex,
        rowKey: getKey(row, rowIndex),
      })),
    [getKey, items],
  );

  const sortedRows = React.useMemo(() => {
    if (!autoSort) {
      return keyedRows;
    }

    const normalizedOrder = normalizeOrderRules(order);
    if (!normalizedOrder.length) {
      return keyedRows;
    }

    const columnMap = new Map(columns.map((column) => [column.field, column]));
    const nextRows = [...keyedRows];
    nextRows.sort((a, b) => compareRows(a.row, b.row, normalizedOrder, columnMap, a.rowIndex, b.rowIndex));
    return nextRows;
  }, [autoSort, columns, keyedRows, order]);

  return (
    <div className={cn("overflow-x-auto overflow-y-auto max-h-[70vh]", className)}>
      <Table variant="list" tableLayout={tableLayout}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.field}
                style={column.width ? { width: column.width } : undefined}
              >
                <div className="flex items-center gap-1">
                  <span>{column.header}</span>
                  {column.editorType === "readonly" && (
                    <span
                      aria-label="閲覧のみ"
                      className="text-muted-foreground text-[10px] leading-none"
                      title="この列は閲覧のみです"
                    >
                      🔒
                    </span>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map(({ row, rowKey }, displayIndex) => (
            <TableRow
              key={rowKey}
              className={cn(
                "group",
                resolveRowClassName(rowClassName, row, { index: displayIndex }),
              )}
            >
              {columns.map((column) => (
                <EditableGridCell
                  key={`${String(rowKey)}-${column.field}`}
                  rowKey={rowKey}
                  row={row}
                  column={column}
                  fallbackPlaceholder={column.placeholder ?? emptyValueFallback}
                  rowHeight={rowHeight}
                  onValidChange={(value) =>
                    onCellChange?.({
                      rowKey,
                      field: column.field,
                      value,
                      row,
                    })
                  }
                />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export * from "./types";
