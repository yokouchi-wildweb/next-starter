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
import type { EditableGridTableProps } from "./types";
import { EditableGridCell } from "./components/EditableGridCell";

export default function EditableGridTable<T>({
  rows,
  columns,
  getKey = (_, index) => index,
  className,
  onCellChange,
  emptyValueFallback = "(未設定)",
  tableLayout = "auto",
}: EditableGridTableProps<T>) {
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
          {rows.map((row, rowIndex) => {
            const rowKey = getKey(row, rowIndex);
            return (
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
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export * from "./types";
