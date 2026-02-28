// src/lib/tableSuite/SortableList/components/SortableItem.tsx

"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { DragHandle } from "./DragHandle";
import type { SortableItem as SortableItemType, SortableItemProps } from "../types";
import {
  resolveColumnFlexAlignClass,
  ROW_HEIGHT_CLASS,
  resolvePaddingClass,
} from "../../types";

/**
 * ソート可能な個別アイテムコンポーネント
 * @dnd-kit/sortable の useSortable を使用
 * memo でラップし、ドラッグ中に変化しないアイテムの再レンダリングを防止
 */
function SortableItemInner<T extends SortableItemType>({
  item,
  columns,
  showDragHandle,
  draggingClassName,
  rowClassName,
  disabled,
  itemHeight,
  itemPaddingX,
  itemPaddingY,
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

  const heightClass = ROW_HEIGHT_CLASS[itemHeight];
  const paddingClass = resolvePaddingClass(itemPaddingX, itemPaddingY);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-lg border bg-background",
        heightClass,
        paddingClass,
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
              resolvePaddingClass(col.paddingX ?? itemPaddingX, col.paddingY ?? itemPaddingY),
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

export const SortableItem = memo(SortableItemInner) as typeof SortableItemInner;
