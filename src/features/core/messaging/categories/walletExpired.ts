// src/features/core/messaging/categories/walletExpired.ts
// 上流の種類: 残高の失効(種別 transactional)。wallet.expiredNotice

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "walletExpired",
  label: "残高の失効",
  description: "残高が有効期限で失効した時のお知らせ",
  kind: "transactional",
  channels: ["email", "inApp"],
};
