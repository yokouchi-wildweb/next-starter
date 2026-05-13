"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

import { cn } from "@/lib/cn";

/**
 * グリッド内の各スロットに対して `renderItem` から渡されるヘルパー
 * - dragHandleListeners: 並び替え可能時のみ設定。ドラッグ可能要素に attach する
 * - isDragging: 当該アイテムが現在ドラッグ中か
 */
export type MediaThumbItemHelpers = {
  dragHandleListeners?: SyntheticListenerMap;
  isDragging: boolean;
};

export type MediaThumbItem = {
  id: string;
};

export type MediaThumbGridProps<T extends MediaThumbItem> = {
  items: T[];
  /** 並び替え可否（既定 true） */
  reorderable?: boolean;
  /** 並び替え操作を一時的に無効化（アップロード中などに使う） */
  disabled?: boolean;
  /** 並び替え結果通知（新しい id 配列順） */
  onReorder?: (newIds: string[]) => void;
  /** 各スロットの中身を描画 */
  renderItem: (item: T, helpers: MediaThumbItemHelpers) => ReactNode;
  /** 末尾に表示する追加スロット（＋ボタン等） */
  trailing?: ReactNode;
  /** 外側コンテナへ追加クラス */
  className?: string;
};

/**
 * 正方形サムネイル用 2D グリッド。
 * `reorderable=true` の場合は @dnd-kit/sortable で並び替え可能、
 * `false` の場合は静的グリッド（DndContext を mount しない）。
 *
 * SSR/CSR の aria-describedby ID 差分を避けるため、reorderable 時は
 * マウント完了後に DndContext を有効化する。
 */
export function MediaThumbGrid<T extends MediaThumbItem>({
  items,
  reorderable = true,
  disabled = false,
  onReorder,
  renderItem,
  trailing,
  className,
}: MediaThumbGridProps<T>) {
  const itemIds = useMemo(() => items.map((it) => it.id), [items]);

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
        className,
      )}
    >
      {reorderable ? (
        <SortableArea
          itemIds={itemIds}
          disabled={disabled}
          onReorder={onReorder}
        >
          {items.map((item) => (
            <SortableThumbCell
              key={item.id}
              item={item}
              disabled={disabled}
              renderItem={renderItem}
            />
          ))}
        </SortableArea>
      ) : (
        items.map((item) => (
          <div key={item.id} className="aspect-square">
            {renderItem(item, { isDragging: false })}
          </div>
        ))
      )}
      {trailing ? <div className="aspect-square">{trailing}</div> : null}
    </div>
  );
}

type SortableAreaProps = {
  itemIds: string[];
  disabled: boolean;
  onReorder?: (newIds: string[]) => void;
  children: ReactNode;
};

function SortableArea({ itemIds, disabled, onReorder, children }: SortableAreaProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = itemIds.indexOf(String(active.id));
      const newIndex = itemIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(itemIds, oldIndex, newIndex);
      onReorder?.(next);
    },
    [itemIds, onReorder],
  );

  if (!mounted) {
    // SSR とハイドレーション差分を避けるため、初回は静的レンダリングする
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={disabled ? undefined : handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy} disabled={disabled}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

type SortableThumbCellProps<T extends MediaThumbItem> = {
  item: T;
  disabled: boolean;
  renderItem: (item: T, helpers: MediaThumbItemHelpers) => ReactNode;
};

function SortableThumbCell<T extends MediaThumbItem>({ item, disabled, renderItem }: SortableThumbCellProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="aspect-square">
      {renderItem(item, { dragHandleListeners: listeners, isDragging })}
    </div>
  );
}
