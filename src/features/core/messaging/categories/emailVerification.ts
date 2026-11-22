// src/features/core/messaging/categories/emailVerification.ts
// 上流のカテゴリー: メールアドレスの確認(種別 functional)。auth.verification

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "emailVerification",
  label: "メールアドレスの確認",
  description: "登録したメールアドレスの確認",
  kind: "functional",
  channels: ["email"],
};
