// src/lib/tableSuite/SortableList/components/SortableItem.tsx

"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { DragHandle } from "./DragHandle";
import type { SortableItem as SortableItemType, SortableItemProps } from "../types";
import { resolveColumnFlexAlignClass } from "../../types";

/**
 * ソート可能な個別アイテムコンポーネント
 * @dnd-kit/sortable の useSortable を使用
 */
export function SortableItem<T extends SortableItemType>({
  item,
  columns,
  showDragHandle,
  draggingClassName,
  rowClassName,
  disabled,
}: SortableItemProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-lg border bg-background p-3",
        "transition-shadow hover:shadow-sm",
        isDragging && "z-50 shadow-lg ring-2 ring-primary/20",
        isDragging && draggingClassName,
        rowClassName
      )}
    >
      {showDragHandle && (
        <DragHandle
          listeners={listeners}
          attributes={attributes}
          disabled={disabled}
        />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {columns.map((col, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center",
              resolveColumnFlexAlignClass(col.align),
              col.width
            )}
            style={
              col.width && !col.width.startsWith("w-")
                ? { width: col.width }
                : undefined
            }
          >
            {col.render(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
