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
import type { EditableGridColumn, EditableGridTableProps } from "./types";
import { EditableGridCell } from "./components/EditableGridCell";
import { normalizeOrderRules, compareRows } from "./utils/sort";

type KeyedRow<T> = {
  row: T;
  rowKey: React.Key;
  rowIndex: number;
};

export default function EditableGridTable<T>({
  rows,
  columns,
  getKey = (_, index) => index,
  className,
  onCellChange,
  emptyValueFallback = "(未設定)",
  tableLayout = "auto",
  autoSort = false,
  order,
}: EditableGridTableProps<T>) {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" && autoSort && (!order || order.length === 0)) {
      console.warn("EditableGridTable: autoSort を有効にする場合は order を指定してください。");
    }
  }, [autoSort, order]);

  const keyedRows = React.useMemo<KeyedRow<T>[]>(
    () =>
      rows.map((row, rowIndex) => ({
        row,
        rowIndex,
        rowKey: getKey(row, rowIndex),
      })),
    [getKey, rows],
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
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map(({ row, rowKey }) => (
            <TableRow key={rowKey}>
              {columns.map((column) => (
                <EditableGridCell
                  key={`${String(rowKey)}-${column.field}`}
                  rowKey={rowKey}
                  row={row}
                  column={column}
                  fallbackPlaceholder={column.placeholder ?? emptyValueFallback}
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
