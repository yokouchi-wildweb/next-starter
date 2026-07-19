// src/lib/tableSuite/shared/reorder/computeGroupedReorder.ts

import { computeReorderResult, type ReorderResult } from "@/lib/sortableList";

type ComputeGroupedReorderArgs<T> = {
  /** 表示順のアイテム配列 */
  items: T[];
  /** items と同順の文字列ID配列 */
  ids: string[];
  /** ドラッグしたアイテムのID */
  activeId: string;
  /** ドロップ先のアイテムのID */
  overId: string;
  /** グループ判定関数（未指定ならフラットな並び替え） */
  getGroup?: (item: T) => string | number;
};

/**
 * グループ対応の ReorderResult 算出。
 *
 * getGroup 指定時:
 * - グループを跨ぐドロップは null（キャンセル）
 * - afterItemId / beforeItemId を同一グループ内のレコードに正規化する。
 *   グループ先頭への移動では表示上の直前行が前グループの末尾になるため、
 *   afterItemId を null（= 先頭挿入）へ落とす。表示順が「グループ → sort_order」であれば、
 *   Fractional Indexing の reorder(id, afterItemId) でグループ内順序が正しく保存される
 *   （sort_order キーはグループ内でしか比較されないため、グローバルな先頭挿入で問題ない）。
 */
export const computeGroupedReorderResult = <T,>({
  items,
  ids,
  activeId,
  overId,
  getGroup,
}: ComputeGroupedReorderArgs<T>): ReorderResult | null => {
  if (!getGroup) {
    return computeReorderResult(ids, activeId, overId);
  }

  const activeIndex = ids.indexOf(activeId);
  const overIndex = ids.indexOf(overId);
  if (activeIndex === -1 || overIndex === -1) {
    return null;
  }

  const group = getGroup(items[activeIndex]);
  if (group !== getGroup(items[overIndex])) {
    return null;
  }

  const result = computeReorderResult(ids, activeId, overId);
  if (!result) {
    return null;
  }

  const normalizeToGroup = (id: string | null): string | null => {
    if (id === null) {
      return null;
    }
    const index = ids.indexOf(id);
    if (index === -1) {
      return null;
    }
    return getGroup(items[index]) === group ? id : null;
  };

  return {
    ...result,
    afterItemId: normalizeToGroup(result.afterItemId),
    beforeItemId: normalizeToGroup(result.beforeItemId),
  };
};
