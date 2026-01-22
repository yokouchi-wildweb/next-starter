// src/lib/tableSuite/SortableList/index.tsx

"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/cn";
import { SortableItem } from "./components";
import type {
  SortableItem as SortableItemType,
  SortableListProps,
  ReorderResult,
} from "./types";
import { resolveRowClassName } from "../types";

/**
 * @dnd-kit はサーバーとクライアントで異なる aria-describedby ID を生成するため、
 * ハイドレーションエラーを防ぐためにマウント後にのみ DndContext をレンダリングする
 */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/**
 * ドラッグ&ドロップで並び替え可能なリストコンポーネント
 *
 * @example
 * ```tsx
 * <SortableList
 *   items={items}
 *   columns={[
 *     { render: (item) => item.title, width: "flex-1" },
 *     { render: (item) => <Badge>{item.status}</Badge>, width: "w-24" },
 *   ]}
 *   onReorder={({ itemId, afterItemId }) => {
 *     // サーバーに並び替えリクエストを送信
 *   }}
 * />
 * ```
 */
export default function SortableList<T extends SortableItemType>({
  items,
  columns,
  onReorder,
  showDragHandle = true,
  draggingClassName,
  className,
  maxHeight,
  rowClassName,
  emptyMessage = "アイテムがありません",
  isLoading,
  disabled,
}: SortableListProps<T>) {
  const mounted = useMounted();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 移動先の前後のアイテムIDを計算
    const afterItemId = newIndex > 0 ? items[newIndex - 1]?.id ?? null : null;
    const beforeItemId =
      newIndex < items.length - 1 ? items[newIndex + 1]?.id ?? null : null;

    // 移動方向を考慮して前後を調整
    const adjustedAfterItemId =
      oldIndex < newIndex ? items[newIndex]?.id ?? null : afterItemId;
    const adjustedBeforeItemId =
      oldIndex > newIndex ? items[newIndex]?.id ?? null : beforeItemId;

    const result: ReorderResult = {
      itemId: String(active.id),
      afterItemId: adjustedAfterItemId,
      beforeItemId: adjustedBeforeItemId,
      newIndex,
      oldIndex,
    };

    onReorder(result);
  };

  const resolvedMaxHeight = maxHeight ?? "70vh";

  // ローディング中またはマウント前はスケルトンを表示
  if (isLoading || !mounted) {
    return (
      <div
        className={cn("flex flex-col gap-2", className)}
        style={{ maxHeight: resolvedMaxHeight }}
      >
        {(items.length > 0 ? items : [...Array(3)]).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg border bg-muted/50"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed p-8",
          "text-muted-foreground",
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-y-auto", className)}
      style={{ maxHeight: resolvedMaxHeight }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {items.map((item, index) => (
              <SortableItem
                key={item.id}
                item={item}
                columns={columns}
                showDragHandle={showDragHandle}
                draggingClassName={draggingClassName}
                rowClassName={resolveRowClassName(rowClassName, item, { index })}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export * from "./types";
export { DragHandle, SortableItem } from "./components";
