// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importGuard.ts
// 取り込みの未保存の守り(lib/unsavedGuard)に渡す値: 取り込み中の間、理由「処理の途中」で守る。guardUnsaved = false なら守らない

import type { UnsavedReason } from "@/lib/unsavedGuard";

export function importUnsavedGuard({ isImporting, guardUnsaved }: { isImporting: boolean; guardUnsaved: boolean }): {
  when: boolean;
  reason: UnsavedReason;
} {
  return { when: guardUnsaved && isImporting, reason: "inProgress" };
}
