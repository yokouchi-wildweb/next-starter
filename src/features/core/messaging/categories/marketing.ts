// src/features/core/messaging/categories/marketing.ts
// 上流の配信停止の種類: 宣伝・お知らせの配信(D35)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "marketing",
  label: "お知らせ・キャンペーン",
  description: "新しい機能やキャンペーンなどのお知らせ",
  kind: "marketing",
};
