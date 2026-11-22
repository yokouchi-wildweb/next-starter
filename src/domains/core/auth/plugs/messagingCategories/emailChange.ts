// src/domains/core/auth/plugs/messagingCategories/emailChange.ts
// 上流のカテゴリー: メールアドレスの変更(種別 functional)。auth.emailChange

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "emailChange",
  label: "メールアドレスの変更",
  description: "新しいメールアドレスの確認",
  kind: "functional",
  channels: ["email"],
};
