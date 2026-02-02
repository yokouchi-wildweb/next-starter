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
  CellClickOverlay,
} from "../shared";
import type { DataTableProps } from "../DataTable";
import {
  resolveColumnTextAlignClass,
  resolveRowClassName,
  ROW_HEIGHT_CLASS,
  resolvePaddingClass,
} from "../types";
import { BulkActionBar, type BulkActionSelection, type BulkActionBarSpacing } from "./components/BulkActionBar";
import { SelectionCell } from "./components/SelectionCell";
import { SelectionHeaderCell } from "./components/SelectionHeaderCell";
import { useRecordSelectionState } from "./hooks/useRecordSelectionState";

export type { BulkActionSelection, BulkActionBarSpacing } from "./components/BulkActionBar";

type SelectionBehavior = "row" | "checkbox";

const EMPTY_KEYS: React.Key[] = [];

export type RecordSelectionTableProps<T> = DataTableProps<T> & {
  selectedKeys?: React.Key[];
  defaultSelectedKeys?: React.Key[];
  onSelectionChange?: (keys: React.Key[], rows: T[]) => void;
  selectionBehavior?: SelectionBehavior;
  selectColumnLabel?: string;
  /**
   * 一括操作バーのアクション部分をレンダリングする関数。
   * 指定すると、1件以上選択時に一括操作バーが表示される。
   * 左側の「N件選択中」と「選択解除」ボタンは自動で表示される。
   */
  bulkActions?: (selection: BulkActionSelection<T>) => React.ReactNode;
  /** 一括操作バーとテーブルの余白 @default "md" */
  bulkActionsSpacing?: BulkActionBarSpacing;
  /** 一括操作バーを常に表示するかどうか @default false */
  bulkActionsAlwaysVisible?: boolean;
  /** 0件選択時のメッセージ @default "行を選択して一括処理を実行" */
  bulkActionsEmptyMessage?: string;
  /**
   * 行ホバー時の背景色変更を無効にするかどうか。
   * @default false
   */
  disableRowHover?: boolean;
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
  defaultSelectedKeys = EMPTY_KEYS,
  onSelectionChange,
  selectionBehavior = "row",
  selectColumnLabel = "選択",
  bottomSentinelRef,
  scrollContainerRef,
  bulkActions,
  bulkActionsSpacing,
  bulkActionsAlwaysVisible,
  bulkActionsEmptyMessage,
  rowHeight = "md",
  cellPaddingX = "sm",
  cellPaddingY = "none",
  disableRowHover = false,
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
  const rowHeightClass = ROW_HEIGHT_CLASS[rowHeight];

  // 一括操作バー用のselectionオブジェクトを作成
  const bulkActionSelection = React.useMemo<BulkActionSelection<T>>(() => {
    const selectedKeysArray = Array.from(selectedKeySet);
    const selectedRows = keyedItems
      .filter(({ key }) => selectedKeySet.has(key))
      .map(({ item }) => item);

    return {
      selectedKeys: selectedKeysArray,
      selectedRows,
      selectedIds: selectedKeysArray.map((key) => String(key)),
      count: selectedKeysArray.length,
      clear: () => updateAllSelection(false),
    };
  }, [keyedItems, selectedKeySet, updateAllSelection]);

  return (
    <>
      {bulkActions && (
        <BulkActionBar
          selection={bulkActionSelection}
          bulkActions={bulkActions}
          spacing={bulkActionsSpacing}
          alwaysVisible={bulkActionsAlwaysVisible}
          emptyMessage={bulkActionsEmptyMessage}
        />
      )}
      <div
        className={cn("w-full max-w-full overflow-x-auto overflow-y-auto", className)}
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
                    rowHeightClass,
                    isClickableRow && "cursor-pointer",
                    isSelected && "bg-muted/60",
                    resolvedRowClass,
                  )}
                  onClick={isClickableRow ? () => handleRowClick(item, key) : undefined}
                  aria-selected={isSelected}
                  data-selected={isSelected ? "true" : undefined}
                  disableHover={disableRowHover}
                >
                  <SelectionCell
                    label={resolvedSelectColumnLabel}
                    rowIndex={itemIndex}
                    isCheckboxSelection={isCheckboxSelection}
                    isSelected={isSelected}
                    onToggle={(checked) => updateKeySelection(key, checked)}
                  />
                  {columns.map((col, idx) => (
                    <TableCell
                      key={idx}
                      className={cn(
                        resolveColumnTextAlignClass(col.align),
                        resolvePaddingClass(col.paddingX ?? cellPaddingX, col.paddingY ?? cellPaddingY),
                        col.cellAction && "relative group",
                      )}
                    >
                      {renderCellContent(col.render(item))}
                      {col.cellAction && (
                        <CellClickOverlay
                          onClick={() => col.cellAction!.onClick(item)}
                          indicator={
                            typeof col.cellAction.indicator === "function"
                              ? col.cellAction.indicator(item)
                              : col.cellAction.indicator
                          }
                          fullWidth={col.cellAction.fullWidth}
                        />
                      )}
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
    </>
  );
}
