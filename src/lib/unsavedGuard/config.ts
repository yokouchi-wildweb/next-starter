// src/lib/unsavedGuard/config.ts
//
// 未保存の編集の守りの確認の文(既定 + 上書き)。上書きは src/config/lib/unsavedGuard.config.ts(@lib-config/unsavedGuard)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 理由ごとに 1 組。複数の理由が立っているときは処理の途中(inProgress)の文を出す(pickConfirmReason)。
// 再読み込み・タブを閉じるときはブラウザの確認になり、この文は出ない(ブラウザが文を変えさせない)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/unsavedGuard";
import type { UnsavedReason } from "./types";

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

export type UnsavedGuardConfig = {
  /** 理由ごとの確認の文 */
  confirm: Record<UnsavedReason, UnsavedGuardConfirmTexts>;
};

const defaults: UnsavedGuardConfig = {
  confirm: {
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
},
};

export const unsavedGuardConfigDef = defineConfig(defaults, { label: "unsavedGuard" });

/** 上書きのファイルの型(`export default { ... } satisfies UnsavedGuardOverride`) */
export type UnsavedGuardOverride<E extends object = Record<never, never>> = OverrideOf<typeof unsavedGuardConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const unsavedGuardConfig: UnsavedGuardConfig = unsavedGuardConfigDef.compose(override);
