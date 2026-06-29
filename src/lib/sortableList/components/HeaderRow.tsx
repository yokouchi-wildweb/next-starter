// src/lib/sortableList/components/HeaderRow.tsx

import { memo } from "react";
import { cn } from "@/lib/cn";
import type {
  SortableItem as SortableItemType,
  SortableListColumn,
} from "../types";
import {
  resolveColumnFlexAlignClass,
  resolvePaddingClass,
  type PaddingSize,
} from "../variants";

type HeaderRowProps<T extends SortableItemType> = {
  columns: SortableListColumn<T>[];
  showDragHandle: boolean;
  itemPaddingX: PaddingSize;
  itemPaddingY: PaddingSize;
  className?: string;
};

/**
 * カラムヘッダー行。
 *
 * データ行（StaticItem / SortableItem）のレイアウトを厳密にミラーし、
 * 各カラムの `header` を表示する。スクロール領域の外・上に置かれるため、
 * 本文が仮想スクロールしてもヘッダーは常に見える（sticky 相当）。
 *
 * 整列のためデータ行と以下を一致させる:
 * - 外側 `flex items-center gap-2` + 行と同じ outer padding
 * - データ行の `rounded-lg border`(1px) と幅を揃えるための透明ボーダー
 * - ドラッグハンドル幅（h-8 w-8 shrink-0）の空スペーサ
 * - 内側 `flex min-w-0 flex-1 items-center gap-3` とカラムごとの align/padding/width
 */
function HeaderRowInner<T extends SortableItemType>({
  columns,
  showDragHandle,
  itemPaddingX,
  itemPaddingY,
  className,
}: HeaderRowProps<T>) {
  const paddingClass = resolvePaddingClass(itemPaddingX, itemPaddingY);

  return (
    <div
      role="row"
      className={cn(
        // データ行と同じ outer レイアウト + 透明ボーダーで 1px ぶんの整列を一致させる
        "flex items-center gap-2 rounded-lg border border-transparent",
        paddingClass,
        "text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {showDragHandle && <div aria-hidden className="h-8 w-8 shrink-0" />}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {columns.map((col, idx) => (
          <div
            key={idx}
            role="columnheader"
            className={cn(
              "flex items-center",
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
            {col.header}
          </div>
        ))}
      </div>
    </div>
  );
}

export const HeaderRow = memo(HeaderRowInner) as typeof HeaderRowInner;
