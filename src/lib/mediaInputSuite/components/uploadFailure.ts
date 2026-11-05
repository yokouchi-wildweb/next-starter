// src/lib/mediaInputSuite/components/uploadFailure.ts
// アップロードの失敗の判定（MediaUploaderMulti の枠から。利用者の中止は失敗に数えない）

type SlotLike = { kind: string; canceled?: boolean };

/** 失敗した枠(中止を除く)が 1 つでもあるか */
export function hasFailedUpload(slots: readonly SlotLike[]): boolean {
  return slots.some((slot) => slot.kind === "error" && !slot.canceled);
}
