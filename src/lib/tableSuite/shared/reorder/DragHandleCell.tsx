// src/lib/tableSuite/shared/reorder/DragHandleCell.tsx

"use client";

import type React from "react";

import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/Form/Button";
import { Span } from "@/components/TextBlocks/Span";

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
      <Span inline srOnly>並び替え</Span>
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
  /** dnd-kit の useSortable の attributes。slot は Form/Button の印の名前とぶつかるので受けない(dnd-kit は slot を渡さない) */
  attributes?: Omit<React.HTMLAttributes<HTMLButtonElement>, "slot">;
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
      <Button
        type="button"
        variant="none"
        size="none"
        // クリックの伝播は外の TableCell が止める(生の button と同じ流れ)
        propagateClick
        ref={activatorRef}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded",
          "text-muted-foreground transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isGrab
            ? "cursor-grab touch-none hover:bg-muted/50 hover:text-foreground active:cursor-grabbing"
            : // Button の土台の disabled:opacity-50 に負けないよう disabled の時の値も 40 にする
              "cursor-not-allowed opacity-40 disabled:opacity-40",
        )}
        disabled={!isGrab}
        title={HANDLE_TITLE[state]}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
        <Span inline srOnly>ドラッグして並び替え</Span>
      </Button>
    </TableCell>
  );
}
