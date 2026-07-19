// src/lib/tableSuite/shared/reorder/TableReorderProvider.tsx

"use client";

import React from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

type TableReorderProviderProps = {
  /** false のときは何も包まず children をそのまま返す */
  active: boolean;
  /** ドラッグ可能な行のID配列（表示順） */
  sortableIds: string[];
  onDragEnd: (event: DragEndEvent) => void;
  children: React.ReactNode;
};

/**
 * 行並び替えが有効なときのみ DndContext / SortableContext でテーブルを包むラッパー。
 * DragOverlay は使わず行を in-place で transform するため、テーブルの列幅が崩れない。
 */
export function TableReorderProvider({
  active,
  sortableIds,
  onDragEnd,
  children,
}: TableReorderProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!active) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
