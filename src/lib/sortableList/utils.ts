// src/lib/sortableList/utils.ts

import type { ReorderResult } from "./types";

/**
 * ドラッグ&ドロップの結果から ReorderResult を算出する。
 *
 * afterItemId / beforeItemId は「移動後に表示上の直前 / 直後になるアイテム」を指す。
 * 移動方向（上→下 / 下→上）による隣接関係のズレはここで吸収する。
 *
 * @param ids - 表示順のアイテムID配列
 * @param activeId - ドラッグしたアイテムのID
 * @param overId - ドロップ先のアイテムのID
 * @returns 並び替え結果。移動なし（同一位置）・ID不明の場合は null
 */
export const computeReorderResult = (
  ids: string[],
  activeId: string,
  overId: string,
): ReorderResult | null => {
  if (activeId === overId) {
    return null;
  }

  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);

  if (oldIndex === -1 || newIndex === -1) {
    return null;
  }

  // 移動先の前後のアイテムIDを計算
  const afterItemId = newIndex > 0 ? ids[newIndex - 1] ?? null : null;
  const beforeItemId = newIndex < ids.length - 1 ? ids[newIndex + 1] ?? null : null;

  // 移動方向を考慮して前後を調整
  const adjustedAfterItemId = oldIndex < newIndex ? ids[newIndex] ?? null : afterItemId;
  const adjustedBeforeItemId = oldIndex > newIndex ? ids[newIndex] ?? null : beforeItemId;

  return {
    itemId: activeId,
    afterItemId: adjustedAfterItemId,
    beforeItemId: adjustedBeforeItemId,
    newIndex,
    oldIndex,
  };
};
