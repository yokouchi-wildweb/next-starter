// src/features/core/messaging/categories/marketing.ts
// 上流の種類: 宣伝(D35・D69 の表示名)。messaging.adminMessage(管理の送信の宣伝)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "marketing",
  label: "キャンペーン情報",
  description: "新しい機能やキャンペーンなどのお知らせ",
  kind: "marketing",
  channels: ["email", "inApp"],
};
