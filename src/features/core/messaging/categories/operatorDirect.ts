// src/features/core/messaging/categories/operatorDirect.ts
// 上流の種類: 運営からのご連絡(種別 direct)。管理者がその場で書く個別の連絡 messaging.adminDirect の既定のカテゴリー(一覧の一括操作の既定、D81)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "operatorDirect",
  label: "運営からのご連絡",
  description: "運営からあなたへの個別のご連絡",
  kind: "direct",
  channels: ["email", "inApp"],
};
