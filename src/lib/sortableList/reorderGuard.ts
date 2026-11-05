// src/lib/sortableList/reorderGuard.ts
// 並べ替えの未保存の守り(lib/unsavedGuard): 並びは落とすたびに使い手が保存する(onReorder)。
// onReorder が返した Promise が終わるまで(並びの保存待ち)、理由「未保存」で守る。void を返す使い手は守らない(保存待ちが無い)。
// 手元で並びをためて後でまとめて保存する画面は、その画面が useUnsavedGuard を呼ぶ(リストは未保存の並びを持たない)

import type { UnsavedReason, UnsavedTasks } from "@/lib/unsavedGuard";

import type { ReorderResult } from "./types";

export const REORDER_GUARD_REASON: UnsavedReason = "unsaved";

/** 並び替えを使い手へ渡し、返った Promise を保存待ちとして数える */
export function runReorder(
  onReorder: (result: ReorderResult) => void | Promise<unknown>,
  result: ReorderResult,
  tasks: UnsavedTasks,
): void {
  tasks.track(onReorder(result));
}
