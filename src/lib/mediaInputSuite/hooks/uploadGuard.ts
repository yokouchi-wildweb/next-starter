// src/lib/mediaInputSuite/hooks/uploadGuard.ts
// アップロードの未保存の守り(lib/unsavedGuard)に渡す値: 送信中(アップロード中)の間、理由「処理の途中」で守る。guardUnsaved = false なら守らない。
// アップロードが済んで保存前の値はフォームの編集済み(AppForm の守り)が受ける(ここでは守らない: 保存の後の移動で聞かないため)

import type { UnsavedReason } from "@/lib/unsavedGuard";

export function uploadUnsavedGuard({ uploading, guardUnsaved }: { uploading: boolean; guardUnsaved: boolean }): {
  when: boolean;
  reason: UnsavedReason;
} {
  return { when: guardUnsaved && uploading, reason: "inProgress" };
}
