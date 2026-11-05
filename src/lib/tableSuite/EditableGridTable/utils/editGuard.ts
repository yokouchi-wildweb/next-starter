// src/lib/tableSuite/EditableGridTable/utils/editGuard.ts
// 表の直接の編集の未保存の守り(lib/unsavedGuard)に渡す値。
// - 書きかけのセル(入力したがまだ確定していない = draft がある)の数を数え、1 つでもあれば理由「未保存」で守る
// - 確定した値の保存待ち(onCellChange が返した Promise)は lib の useUnsavedTasks が数える(同じ理由)
// guardUnsaved = false ならどちらも守らない

import type { UnsavedReason } from "@/lib/unsavedGuard";

/** 書きかけのセルの集まり。数が変わった時だけ onCount を呼ぶ */
export function createDraftCells(onCount: (count: number) => void) {
  const keys = new Set<string>();
  return {
    set(cellKey: string, drafting: boolean) {
      const before = keys.size;
      if (drafting) keys.add(cellKey);
      else keys.delete(cellKey);
      if (keys.size !== before) onCount(keys.size);
    },
    count: () => keys.size,
  };
}

export const EDIT_GUARD_REASON: UnsavedReason = "unsaved";

export function editUnsavedGuard({ draftCount, guardUnsaved }: { draftCount: number; guardUnsaved: boolean }): {
  when: boolean;
  reason: UnsavedReason;
} {
  return { when: guardUnsaved && draftCount > 0, reason: EDIT_GUARD_REASON };
}
