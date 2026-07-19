// src/lib/tableSuite/EditableGridTable/index.tsx

"use client";

import React from "react";

import { Lock, PencilLine } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  Table,
  TableBody,
  TableHeader,
  SortableTableHead,
  TableRow,
  renderColumnHeader,
  TableReorderProvider,
  ReorderableRow,
  DragHandleHead,
  useTableReorder,
} from "../shared";
import { resolveColumnTextAlignClass, resolveRowClassName, ROW_HEIGHT_CLASS } from "../types";
import type { EditableGridColumn, EditableGridTableProps } from "./types";
import { EditableGridCell } from "./components/EditableGridCell";

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
  maxHeight,
  rowClassName,
  onCellChange,
  emptyValueFallback = "(未設定)",
  tableLayout = "auto",
  rowHeight = "md",
  cellPaddingX = "sm",
  cellPaddingY = "none",
  headerIconMode = "readonly",
  highlightReadonlyCells = true,
  scrollContainerRef,
  bottomSentinelRef,
  disableRowHover = false,
  sort,
  onSortChange,
  reorderable,
}: EditableGridTableProps<T>) {
  const keyedRows = React.useMemo<KeyedRow<T>[]>(
    () =>
      items.map((row, rowIndex) => ({
        row,
        rowIndex,
        rowKey: getKey(row, rowIndex),
      })),
    [getKey, items],
  );

  const renderHeaderIcon = React.useCallback(
    (column: EditableGridColumn<T>) => {
      if (column.editorType === "action") {
        return null;
      }

      if (headerIconMode === "none") {
        return null;
      }

      const shouldShowReadonlyIcon = headerIconMode === "readonly" || headerIconMode === "both";
      const shouldShowEditableIcon = headerIconMode === "editable" || headerIconMode === "both";

      if (shouldShowReadonlyIcon && column.editorType === "readonly") {
        return (
          <span
            aria-label="閲覧のみ"
            className="text-muted-foreground text-[10px] leading-none flex items-center"
            title="この列は閲覧のみです"
          >
            <Lock aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
          </span>
        );
      }

      if (shouldShowEditableIcon && column.editorType !== "readonly") {
        return (
          <span
            aria-label="編集可能"
            className="text-blue-500 text-[10px] leading-none flex items-center"
            title="この列は編集可能です"
          >
            <PencilLine aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
          </span>
        );
      }

      return null;
    },
    [headerIconMode],
  );

  const resolvedMaxHeight = maxHeight ?? "70vh";
  const rowHeightClass = ROW_HEIGHT_CLASS[rowHeight];

  const reorder = useTableReorder({ items, getKey, reorderable, sort });

  return (
    <div
      className={cn("w-full max-w-full overflow-x-auto overflow-y-auto", className)}
      style={{ maxHeight: resolvedMaxHeight }}
      ref={scrollContainerRef}
    >
      <TableReorderProvider
        active={reorder.active}
        sortableIds={reorder.sortableIds}
        onDragEnd={reorder.handleDragEnd}
      >
      <Table variant="list" tableLayout={tableLayout}>
        <TableHeader>
          <TableRow disableHover>
            {reorder.enabled && <DragHandleHead />}
            {columns.map((column) => (
              <SortableTableHead
                key={column.field}
                sortKey={column.sortable ? column.field : undefined}
                sort={sort}
                onSortChange={onSortChange}
                style={column.width ? { width: column.width } : undefined}
                className={resolveColumnTextAlignClass(column.align)}
              >
                <span>{renderColumnHeader(column.header, column.headerHelp)}</span>
                {renderHeaderIcon(column)}
              </SortableTableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {keyedRows.map(({ row, rowKey }, displayIndex) => (
            <ReorderableRow
              key={rowKey}
              reorder={reorder}
              item={row}
              rowId={reorder.ids[displayIndex]}
              className={cn(
                "group",
                rowHeightClass,
                resolveRowClassName(rowClassName, row, { index: displayIndex }),
              )}
              disableHover={disableRowHover}
            >
              {columns.map((column) => (
                <EditableGridCell
                  key={`${String(rowKey)}-${column.field}`}
                  rowKey={rowKey}
                  row={row}
                  column={column}
                  fallbackPlaceholder={column.placeholder ?? emptyValueFallback}
                  cellPaddingX={column.paddingX ?? cellPaddingX}
                  cellPaddingY={column.paddingY ?? cellPaddingY}
                  highlightReadonly={highlightReadonlyCells}
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
            </ReorderableRow>
          ))}
        </TableBody>
      </Table>
      </TableReorderProvider>
      {bottomSentinelRef ? (
        <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
      ) : null}
    </div>
  );
}

export * from "./types";
