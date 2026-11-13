// src/features/core/messaging/categories/activity.ts
// 上流の種類: 利用者の動きから起こる連絡(いいね・返信など、D35)。上流の連絡は使わない(テンプレートが選べる汎用の種類として残す)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "activity",
  label: "アクティビティ",
  description: "あなたへの反応(いいね・返信など)のお知らせ",
  kind: "activity",
  channels: ["email", "inApp"],
};
