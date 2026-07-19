// src/lib/sortableList/SortableList.tsx

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useVirtualizer,
  defaultRangeExtractor,
  type Range,
} from "@tanstack/react-virtual";
import { cn } from "@/lib/cn";
import { HeaderRow, SortableItem, StaticItem } from "./components";
import type {
  SortableItem as SortableItemType,
  SortableListProps,
} from "./types";
import { resolveRowClassName } from "./types";
import { computeReorderResult } from "./utils";
import type { RowHeight } from "./variants";

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

/** ROW_HEIGHT_CLASS (h-XX) に対応するピクセル値 */
const ROW_HEIGHT_PX: Record<RowHeight, number> = {
  xs: 32, // h-8
  sm: 40, // h-10
  md: 48, // h-12
  lg: 56, // h-14
  xl: 64, // h-16
};

/** アイテム間のギャップ（gap-2 = 8px） */
const ITEM_GAP = 8;

/**
 * ドラッグ&ドロップで並び替え可能なリストコンポーネント
 *
 * 仮想スクロール（@tanstack/react-virtual）により、
 * 大量アイテムでもDOMノード数を最小限に保つ。
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
  showHeader = false,
  headerClassName,
  draggingClassName,
  className,
  maxHeight,
  rowClassName,
  emptyMessage = "アイテムがありません",
  isLoading,
  disabled,
  isItemDisabled,
  itemHeight = "md",
  itemPaddingX = "sm",
  itemPaddingY = "none",
}: SortableListProps<T>) {
  const mounted = useMounted();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // SortableContext 用のアイテムID配列をメモ化
  const sortableItemIds = useMemo(
    () =>
      items
        .filter((item) => !isItemDisabled?.(item))
        .map((item) => item.id),
    [items, isItemDisabled]
  );

  const rowHeightPx = ROW_HEIGHT_PX[itemHeight];
  const estimatedItemSize = rowHeightPx + ITEM_GAP;

  // ドラッグ中のアイテムが仮想化で除外されないよう rangeExtractor をカスタマイズ
  const activeIndex = useMemo(() => {
    if (!activeId) return -1;
    return items.findIndex((item) => item.id === activeId);
  }, [activeId, items]);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const result = defaultRangeExtractor(range);
      if (activeIndex !== -1 && !result.includes(activeIndex)) {
        result.push(activeIndex);
        result.sort((a, b) => a - b);
      }
      return result;
    },
    [activeIndex]
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedItemSize,
    overscan: 5,
    rangeExtractor,
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over) {
        return;
      }

      const result = computeReorderResult(
        items.map((item) => item.id),
        String(active.id),
        String(over.id),
      );

      if (result) {
        onReorder(result);
      }
    },
    [items, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const resolvedMaxHeight = maxHeight ?? "70vh";

  /**
   * showHeader 時にカラムヘッダー行をスクロール領域の外・上に配置する。
   * loading / empty / データ表示のすべての状態で同じヘッダーが表示され、
   * 本文の仮想スクロールにも干渉しない（ヘッダーは scroll element の外側）。
   * showHeader=false のときは本文をそのまま返し、既存の描画と完全に一致させる。
   */
  const withHeader = (body: React.ReactNode) => {
    if (!showHeader) {
      return body;
    }
    return (
      <div className="flex w-full max-w-full flex-col gap-2">
        <HeaderRow
          columns={columns}
          showDragHandle={showDragHandle}
          itemPaddingX={itemPaddingX}
          itemPaddingY={itemPaddingY}
          className={headerClassName}
        />
        {body}
      </div>
    );
  };

  // ローディング中またはマウント前はスケルトンを表示
  if (isLoading || !mounted) {
    return withHeader(
      <div
        className={cn("w-full max-w-full flex flex-col gap-2", className)}
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
    return withHeader(
      <div
        className={cn(
          "w-full max-w-full flex items-center justify-center rounded-lg border border-dashed p-8",
          "text-muted-foreground",
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return withHeader(
    <div
      ref={scrollContainerRef}
      className={cn("w-full max-w-full overflow-y-auto", className)}
      style={{ maxHeight: resolvedMaxHeight }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={sortableItemIds}
          strategy={verticalListSortingStrategy}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              const index = virtualRow.index;
              return (
                <div
                  key={item.id}
                  style={{
                    position: "absolute",
                    top: virtualRow.start,
                    left: 0,
                    width: "100%",
                    height: rowHeightPx,
                  }}
                >
                  {isItemDisabled?.(item) ? (
                    <StaticItem
                      item={item}
                      columns={columns}
                      showDragHandle={showDragHandle}
                      rowClassName={resolveRowClassName(rowClassName, item, {
                        index,
                      })}
                      itemHeight={itemHeight}
                      itemPaddingX={itemPaddingX}
                      itemPaddingY={itemPaddingY}
                    />
                  ) : (
                    <SortableItem
                      item={item}
                      columns={columns}
                      showDragHandle={showDragHandle}
                      draggingClassName={draggingClassName}
                      rowClassName={resolveRowClassName(rowClassName, item, {
                        index,
                      })}
                      disabled={disabled}
                      itemHeight={itemHeight}
                      itemPaddingX={itemPaddingX}
                      itemPaddingY={itemPaddingY}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
