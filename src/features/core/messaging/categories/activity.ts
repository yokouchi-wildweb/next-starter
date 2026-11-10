// src/features/core/messaging/categories/activity.ts
// 上流の配信停止の種類: 利用者の動きから起こる連絡(いいね・返信など、D35)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "activity",
  label: "アクティビティ",
  description: "あなたへの反応(いいね・返信など)のお知らせ",
  kind: "activity",
};
