// src/features/core/messaging/categories/promotion.ts
// 上流の種類: 宣伝(D35・D69 の表示名)。管理者がその場で書く宣伝 messaging.adminPromotion の既定のカテゴリー

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "promotion",
  label: "キャンペーン情報",
  description: "新しい機能やキャンペーンなどのお知らせ",
  kind: "promotion",
  channels: ["email", "inApp"],
};
