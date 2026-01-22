// src/lib/tableSuite/SortableList/components/DragHandle.tsx

"use client";

import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { cn } from "@/lib/cn";
import { GripVertical } from "lucide-react";

type DragHandleProps = {
  listeners?: SyntheticListenerMap;
  attributes?: React.HTMLAttributes<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
};

/**
 * ドラッグ用のハンドルコンポーネント
 * ⠿ アイコンを表示し、ドラッグ操作のトリガーとなる
 */
export function DragHandle({
  listeners,
  attributes,
  disabled,
  className,
}: DragHandleProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted/50 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && "cursor-grab active:cursor-grabbing",
        className
      )}
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
      <span className="sr-only">ドラッグして並び替え</span>
    </button>
  );
}
