// src/features/core/messaging/categories/accountLocked.ts
// 上流の種類: アカウントのロック(種別 security)。auth.accountLocked

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "accountLocked",
  label: "アカウントのロック",
  description: "ログインの失敗が続いてアカウントがロックされた時のお知らせ",
  kind: "security",
  channels: ["email"],
};
