/**
 * 未保存の編集の守り(src/lib/unsavedGuard)の確認の文
 *
 * ★ プロジェクトごとにこのファイルの値を編集して文を替えてください(理由の一覧・キーは lib が決める)
 * - 理由ごとに 1 組。複数の理由が立っているときは処理の途中(inProgress)の文を出す(lib の pickConfirmReason)
 * - 再読み込み・タブを閉じるときはブラウザの確認になり、この文は出ない(ブラウザが文を変えさせない)
 */

import type { UnsavedReason } from "@/lib/unsavedGuard";

export type UnsavedGuardConfirmTexts = {
  /** 確認の題 */
  title: string;
  /** 確認の説明 */
  description: string;
  /** 離れるボタンの語 */
  confirmLabel: string;
  /** 留まるボタンの語 */
  cancelLabel: string;
};

export const UNSAVED_GUARD_CONFIRM: Record<UnsavedReason, UnsavedGuardConfirmTexts> = {
  /** 保存していない変更がある(フォーム・表の書きかけ・保存待ち・並べ替えの保存待ち) */
  unsaved: {
    title: "編集中の内容があります",
    description: "保存していない変更は失われます。このページを離れますか？",
    confirmLabel: "離れる",
    cancelLabel: "留まる",
  },
  /** 処理の途中(取り込み中・アップロード中) */
  inProgress: {
    title: "処理の途中です",
    description: "ページを離れると、取り込みやアップロードなどの処理が中断されます。このページを離れますか？",
    confirmLabel: "離れる",
    cancelLabel: "留まる",
  },
};
