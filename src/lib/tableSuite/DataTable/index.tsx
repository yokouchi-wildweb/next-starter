// src/components/Tables/DataTable/index.tsx

"use client";

import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  SortableTableHead,
  TableCell,
  CellClickOverlay,
  getCellClickOverlayClassName,
  renderColumnHeader,
  FullWidthRowsAt,
} from "../shared";
import { cn } from "@/lib/cn";
import type {
  TableColumnAlignment,
  TableStylingProps,
  TableCellStyleProps,
  ColumnSortProps,
  PaddingSize,
  CellAction,
  FullWidthRow,
} from "../types";
import {
  resolveColumnTextAlignClass,
  resolveRowClassName,
  ROW_HEIGHT_CLASS,
  resolvePaddingClass,
  groupFullWidthRowsByIndex,
} from "../types";

// 後方互換性のため再エクスポート
export type { CellAction } from "../types";

export type DataTableColumn<T> = {
  header: React.ReactNode;
  /**
   * ヘッダーに ?アイコン + ホバー説明を添える（HelpTip に合成される）。
   * 集計値・派生値など名前だけでは意味が伝わらない列に使用する。
   */
  headerHelp?: React.ReactNode;
  render: (item: T) => React.ReactNode;
  align?: TableColumnAlignment;
  /**
   * ソート可能にする場合のキー。指定するとヘッダーがクリック可能になる。
   */
  sortKey?: string;
  /**
   * このカラムの水平パディングを上書き
   */
  paddingX?: PaddingSize;
  /**
   * このカラムの垂直パディングを上書き
   */
  paddingY?: PaddingSize;
  /**
   * カラムの幅。CSS の width 値で指定する（例: "200px", "30%", "auto"）。
   * ヘッダー（th）に適用され、テーブルの列幅として反映される。
   */
  width?: string;
  /**
   * セルにクリック可能なオーバーレイを追加する。
   * ホバー時にクリック領域とインジケーターが表示される。
   */
  cellAction?: CellAction<T>;
};

export type RowCursor = "pointer" | "default" | "zoom-in" | "grab";

export type DataTableProps<T> = TableStylingProps<T> &
  TableCellStyleProps &
  ColumnSortProps & {
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
    /**
     * 全幅の差し込み行（グループの空き枠表示・区切り・注釈など）。
     * afterIndex 指定でデータ行の間に挿入する。選択・行クリック・ソートの対象外。
     */
    fullWidthRows?: FullWidthRow[];
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
  fullWidthRows,
  sort,
  onSortChange,
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

  const fullWidthRowsByIndex = React.useMemo(
    () => groupFullWidthRowsByIndex(fullWidthRows, items.length),
    [fullWidthRows, items.length],
  );

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
              <SortableTableHead
                key={idx}
                sortKey={col.sortKey}
                sort={sort}
                onSortChange={onSortChange}
                style={col.width ? { width: col.width } : undefined}
                className={resolveColumnTextAlignClass(col.align)}
              >
                {renderColumnHeader(col.header, col.headerHelp)}
              </SortableTableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <FullWidthRowsAt rowsByIndex={fullWidthRowsByIndex} index={-1} colSpan={columns.length} />
          {items.map((item, index) => (
            <React.Fragment key={getKey(item, index)}>
            <TableRow
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
            <FullWidthRowsAt rowsByIndex={fullWidthRowsByIndex} index={index} colSpan={columns.length} />
            </React.Fragment>
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
