// src/lib/tableSuite/shared/reorder/DragHandleCell.tsx

"use client";

import type React from "react";

import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/cn";

import { TableCell } from "../TableCell";
import { TableHead } from "../TableHead";
import type { DragHandleState } from "./useTableReorder";

/** ハンドル列の共通幅・パディング */
const HANDLE_COLUMN_CLASS = "w-9 px-1";

/**
 * ドラッグハンドル列のヘッダーセル
 */
export function DragHandleHead() {
  return (
    <TableHead className={HANDLE_COLUMN_CLASS}>
      <span className="sr-only">並び替え</span>
    </TableHead>
  );
}

const HANDLE_TITLE: Record<DragHandleState, string | undefined> = {
  grab: undefined,
  sortLocked: "カラムソート中は並び替えできません",
  disabled: undefined,
};

type DragHandleCellProps = {
  state: DragHandleState;
  listeners?: SyntheticListenerMap;
  attributes?: React.HTMLAttributes<HTMLButtonElement>;
  activatorRef?: (element: HTMLElement | null) => void;
};

/**
 * ドラッグハンドルセル。
 * 行クリック（選択・onRowClick）へクリックを伝播させない。
 * sortableList の DragHandle と同じ見た目（GripVertical）で統一する。
 */
export function DragHandleCell({
  state,
  listeners,
  attributes,
  activatorRef,
}: DragHandleCellProps) {
  const isGrab = state === "grab";

  return (
    <TableCell
      className={HANDLE_COLUMN_CLASS}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        ref={activatorRef}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded",
          "text-muted-foreground transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isGrab
            ? "cursor-grab touch-none hover:bg-muted/50 hover:text-foreground active:cursor-grabbing"
            : "cursor-not-allowed opacity-40",
        )}
        disabled={!isGrab}
        title={HANDLE_TITLE[state]}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
        <span className="sr-only">ドラッグして並び替え</span>
      </button>
    </TableCell>
  );
}
