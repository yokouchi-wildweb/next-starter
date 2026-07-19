// src/lib/tableSuite/shared/reorder/ReorderableRow.tsx

"use client";

import React from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/cn";

import { TableRow } from "../TableRow";
import { DragHandleCell } from "./DragHandleCell";
import type { DragHandleState, TableReorderState } from "./useTableReorder";

type RowBaseProps = React.ComponentProps<typeof TableRow>;

type ReorderableRowProps<T> = RowBaseProps & {
  reorder: TableReorderState<T>;
  item: T;
  /** useTableReorder が返す ids の対応値（getKey ベースの文字列ID） */
  rowId: string;
};

/**
 * 並び替え対応の行ラッパー。
 * - reorderable 未指定: 素の TableRow（ハンドル列なし・従来と同一の描画）
 * - reorderable 指定 + ドラッグ不可の行: ハンドル列（薄表示）付きの TableRow
 * - reorderable 指定 + ドラッグ可能な行: useSortable を適用した行 + アクティブなハンドル
 */
export function ReorderableRow<T>({
  reorder,
  item,
  rowId,
  children,
  ...rowProps
}: ReorderableRowProps<T>) {
  if (!reorder.enabled) {
    return <TableRow {...rowProps}>{children}</TableRow>;
  }

  const { dragEnabled, handleState } = reorder.resolveRowReorder(item);

  if (!dragEnabled) {
    return (
      <TableRow {...rowProps}>
        <DragHandleCell state={handleState} />
        {children}
      </TableRow>
    );
  }

  return (
    <SortableRow rowId={rowId} handleState={handleState} {...rowProps}>
      {children}
    </SortableRow>
  );
}

type SortableRowProps = RowBaseProps & {
  rowId: string;
  handleState: DragHandleState;
};

/**
 * useSortable を適用した行。
 * リスナーはハンドルのみに付け、行全体のクリック操作（選択・onRowClick・セル編集）と衝突させない。
 */
function SortableRow({ rowId, handleState, className, children, ...rowProps }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "relative z-10 bg-muted/60 shadow-md", className)}
      {...rowProps}
    >
      <DragHandleCell
        state={handleState}
        listeners={listeners}
        attributes={attributes as unknown as React.HTMLAttributes<HTMLButtonElement>}
        activatorRef={setActivatorNodeRef}
      />
      {children}
    </TableRow>
  );
}
