// src/lib/sortableList/components/StaticItem.tsx

import { memo } from "react";
import { Flex } from "@/components/Layout/Flex";
import { cn } from "@/lib/cn";
import { DragHandle } from "./DragHandle";
import type {
  SortableItem as SortableItemType,
  SortableListColumn,
} from "../types";
import {
  resolveColumnFlexAlignClass,
  ROW_HEIGHT_CLASS,
  resolvePaddingClass,
  type RowHeight,
  type PaddingSize,
} from "../variants";

type StaticItemProps<T extends SortableItemType> = {
  item: T;
  columns: SortableListColumn<T>[];
  showDragHandle: boolean;
  rowClassName?: string;
  itemHeight: RowHeight;
  itemPaddingX: PaddingSize;
  itemPaddingY: PaddingSize;
};

/**
 * ドラッグ無効なアイテムの静的レンダリング
 * SortableContext から除外されるため useSortable を使用しない
 * memo でラップし、不要な再レンダリングを防止
 */
function StaticItemInner<T extends SortableItemType>({
  item,
  columns,
  showDragHandle,
  rowClassName,
  itemHeight,
  itemPaddingX,
  itemPaddingY,
}: StaticItemProps<T>) {
  const heightClass = ROW_HEIGHT_CLASS[itemHeight];
  const paddingClass = resolvePaddingClass(itemPaddingX, itemPaddingY);

  return (
    <Flex
      align="center"
      className={cn(
        "group gap-2 rounded-lg border bg-background",
        heightClass,
        paddingClass,
        "transition-shadow",
        rowClassName
      )}
    >
      {showDragHandle && <DragHandle disabled />}
      <Flex align="center" className="min-w-0 flex-1 gap-3">
        {columns.map((col, idx) => (
          <Flex
            key={idx}
            align="center"
            className={cn(
              resolveColumnFlexAlignClass(col.align),
              resolvePaddingClass(
                col.paddingX ?? itemPaddingX,
                col.paddingY ?? itemPaddingY
              ),
              col.width
            )}
            style={
              col.width && !col.width.startsWith("w-")
                ? { width: col.width }
                : undefined
            }
          >
            {col.render(item)}
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}

export const StaticItem = memo(StaticItemInner) as typeof StaticItemInner;
