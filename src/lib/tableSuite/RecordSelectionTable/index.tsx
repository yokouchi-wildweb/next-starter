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
} from "../DataTable/components";
import type { DataTableProps } from "../DataTable";
import { resolveColumnTextAlignClass, resolveRowClassName } from "../types";
import { SelectionCell } from "./components/SelectionCell";
import { SelectionHeaderCell } from "./components/SelectionHeaderCell";
import { useRecordSelectionState } from "./hooks/useRecordSelectionState";

type SelectionBehavior = "row" | "checkbox";

export type RecordSelectionTableProps<T> = DataTableProps<T> & {
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
  className,
  maxHeight,
  rowClassName,
  onRowClick,
  emptyValueFallback,
  selectedKeys,
  defaultSelectedKeys = [],
  onSelectionChange,
  selectionBehavior = "row",
  selectColumnLabel = "選択",
  bottomSentinelRef,
  scrollContainerRef,
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

  const shouldHandleRowSelection = selectionBehavior === "row";
  const isCheckboxSelection = selectionBehavior === "checkbox";

  const handleRowClick = (item: T, key: React.Key) => {
    if (shouldHandleRowSelection) {
      updateKeySelection(key);
    }
    onRowClick?.(item);
  };

  const resolvedSelectColumnLabel = selectColumnLabel || "選択";

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
            <SelectionHeaderCell
              label={resolvedSelectColumnLabel}
              isCheckboxSelection={isCheckboxSelection}
              checked={isAllSelected}
              indeterminate={isPartialSelection}
              onToggle={(checked) => updateAllSelection(checked)}
              onRequestToggle={() => updateAllSelection(!isAllSelected)}
            />
            {columns.map((col, idx) => (
              <TableHead key={idx} className={resolveColumnTextAlignClass(col.align)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {keyedItems.map(({ item, key }, itemIndex) => {
            const isSelected = selectedKeySet.has(key);
            const resolvedRowClass = resolveRowClassName(rowClassName, item, {
              index: itemIndex,
              selected: isSelected,
            });
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
                  <TableCell key={idx} className={resolveColumnTextAlignClass(col.align)}>
                    {renderCellContent(col.render(item))}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {bottomSentinelRef ? (
        <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
      ) : null}
    </div>
  );
}
