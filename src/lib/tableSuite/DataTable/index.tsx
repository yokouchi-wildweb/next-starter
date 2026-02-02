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
  CellClickOverlay,
  getCellClickOverlayClassName,
} from "../shared";
import { cn } from "@/lib/cn";
import type {
  TableColumnAlignment,
  TableStylingProps,
  TableCellStyleProps,
  PaddingSize,
} from "../types";
import {
  resolveColumnTextAlignClass,
  resolveRowClassName,
  ROW_HEIGHT_CLASS,
  resolvePaddingClass,
} from "../types";

/**
 * セルのクリックアクション設定
 */
export type CellAction<T> = {
  /**
   * セルクリック時のコールバック（popover 使用時は省略可）
   */
  onClick?: (item: T) => void;
  /**
   * ポップオーバーモード：CellClickOverlay をトリガーとして受け取り、ポップオーバーを返す
   * onClick の代わりに使用する
   */
  popover?: (item: T, trigger: React.ReactNode) => React.ReactNode;
  /**
   * 右端に表示するインジケーター。
   * デフォルト: 目のアイコン
   * ReactNode または関数を渡すことで自由にカスタマイズ可能（文字列、アイコン、コンポーネントなど）
   * 関数を渡すと行データに基づいて動的にインジケーターを生成できる
   */
  indicator?: React.ReactNode | ((item: T) => React.ReactNode);
  /**
   * セル全体をクリック領域にする（デフォルト: false）
   * true の場合、ホバー時にセル全体がオーバーレイされる
   */
  fullWidth?: boolean;
};

export type DataTableColumn<T> = {
  header: React.ReactNode;
  render: (item: T) => React.ReactNode;
  align?: TableColumnAlignment;
  /**
   * このカラムの水平パディングを上書き
   */
  paddingX?: PaddingSize;
  /**
   * このカラムの垂直パディングを上書き
   */
  paddingY?: PaddingSize;
  /**
   * セルにクリック可能なオーバーレイを追加する。
   * ホバー時にクリック領域とインジケーターが表示される。
   */
  cellAction?: CellAction<T>;
};

export type RowCursor = "pointer" | "default" | "zoom-in" | "grab";

export type DataTableProps<T> = TableStylingProps<T> &
  TableCellStyleProps & {
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
    /**
     * 行ホバー時の背景色変更を無効にする
     * @default false
     */
    disableRowHover?: boolean;
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
  rowHeight = "md",
  cellPaddingX = "sm",
  cellPaddingY = "none",
  disableRowHover = false,
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
  const rowHeightClass = ROW_HEIGHT_CLASS[rowHeight];

  return (
    <div
      className={cn("w-full max-w-full overflow-x-auto overflow-y-auto", className)}
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
                rowHeightClass,
                onRowClick && ROW_CURSOR_CLASS[rowCursor],
                resolveRowClassName(rowClassName, item, { index }),
              )}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              disableHover={disableRowHover}
            >
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
                  {col.cellAction &&
                    (() => {
                      const indicator =
                        typeof col.cellAction!.indicator === "function"
                          ? col.cellAction!.indicator(item)
                          : col.cellAction!.indicator;

                      // ポップオーバーモード: 共通スタイルを使用
                      if (col.cellAction!.popover) {
                        const fullWidth = col.cellAction!.fullWidth ?? false;
                        const triggerButton = (
                          <button
                            type="button"
                            data-slot="cell-click-overlay"
                            onClick={(e) => e.stopPropagation()}
                            className={getCellClickOverlayClassName(fullWidth)}
                            aria-label="詳細を表示"
                          >
                            <span data-slot="cell-click-indicator" className="pointer-events-none">
                              {indicator}
                            </span>
                          </button>
                        );

                        return col.cellAction!.popover(item, triggerButton);
                      }

                      // コールバックモード（従来）
                      return (
                        <CellClickOverlay
                          onClick={() => col.cellAction!.onClick?.(item)}
                          indicator={indicator}
                          fullWidth={col.cellAction!.fullWidth}
                        />
                      );
                    })()}
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
