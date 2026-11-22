// src/domains/core/messaging/categories/passwordReset.ts
// 上流のカテゴリー: パスワードの再設定(種別 functional)。auth.passwordReset

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "passwordReset",
  label: "パスワードの再設定",
  description: "パスワードを再設定するためのご案内",
  kind: "functional",
  channels: ["email"],
};
