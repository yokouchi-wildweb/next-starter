// src/components/Tables/RecordSelectionTable/index.tsx

"use client";

import React from "react";

import { cn } from "@/lib/cn";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../DataTable/Table";
import type { DataTableProps } from "../DataTable";
import { SelectionCell } from "./components/SelectionCell";
import { SelectionHeaderCell } from "./components/SelectionHeaderCell";
import { useRecordSelectionState } from "./hooks/useRecordSelectionState";

type SelectionBehavior = "row" | "checkbox";

export type RecordSelectionTableProps<T> = Omit<
  DataTableProps<T>,
  "rowClassName" | "onRowClick"
> & {
  rowClassName?: string | ((item: T, options: { selected: boolean }) => string);
  onRowClick?: (item: T) => void;
  selectedKeys?: React.Key[];
  defaultSelectedKeys?: React.Key[];
  onSelectionChange?: (keys: React.Key[], rows: T[]) => void;
  selectionBehavior?: SelectionBehavior;
  selectColumnLabel?: string;
};

export default function RecordSelectionTable<T>({
  items = [],
  columns,
  getKey = (_, index) => index,
  rowClassName,
  onRowClick,
  emptyValueFallback,
  selectedKeys,
  defaultSelectedKeys = [],
  onSelectionChange,
  selectionBehavior = "row",
  selectColumnLabel = "選択",
}: RecordSelectionTableProps<T>) {
  const resolvedFallback = emptyValueFallback ?? "(未設定)";
  const renderCellContent = (content: React.ReactNode) => {
    if (content) {
      return content;
    }
    return (
      <span className="text-muted-foreground text-xs font-medium">{resolvedFallback}</span>
    );
  };

  const {
    keyedItems,
    selectedKeySet,
    isAllSelected,
    isPartialSelection,
    updateKeySelection,
    updateAllSelection,
  } = useRecordSelectionState({
    items,
    getKey,
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
  });

  const resolveRowClassName = (item: T, selected: boolean) => {
    if (typeof rowClassName === "function") {
      return rowClassName(item, { selected });
    }
    return rowClassName;
  };

  const shouldHandleRowSelection = selectionBehavior === "row";
  const isCheckboxSelection = selectionBehavior === "checkbox";

  const handleRowClick = (item: T, key: React.Key) => {
    if (shouldHandleRowSelection) {
      updateKeySelection(key);
    }
    onRowClick?.(item);
  };

  const resolvedSelectColumnLabel = selectColumnLabel || "選択";

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
      <Table variant="list">
        <TableHeader>
          <TableRow>
            <SelectionHeaderCell
              label={resolvedSelectColumnLabel}
              isCheckboxSelection={isCheckboxSelection}
              checked={isAllSelected}
              indeterminate={isPartialSelection}
              onToggle={(checked) => updateAllSelection(checked)}
              onRequestToggle={() => updateAllSelection(!isAllSelected)}
            />
            {columns.map((col, idx) => (
              <TableHead key={idx}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {keyedItems.map(({ item, key }, itemIndex) => {
            const isSelected = selectedKeySet.has(key);
            const resolvedRowClass = resolveRowClassName(item, isSelected);
            const isClickableRow = shouldHandleRowSelection || Boolean(onRowClick);

            return (
              <TableRow
                key={key}
                className={cn(
                  "group",
                  isClickableRow && "cursor-pointer",
                  isSelected && "bg-muted/60",
                  resolvedRowClass,
                )}
                onClick={isClickableRow ? () => handleRowClick(item, key) : undefined}
                aria-selected={isSelected}
                data-selected={isSelected ? "true" : undefined}
              >
                <SelectionCell
                  label={resolvedSelectColumnLabel}
                  rowIndex={itemIndex}
                  isCheckboxSelection={isCheckboxSelection}
                  isSelected={isSelected}
                  onToggle={(checked) => updateKeySelection(key, checked)}
                />
                {columns.map((col, idx) => (
                  <TableCell key={idx}>{renderCellContent(col.render(item))}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
