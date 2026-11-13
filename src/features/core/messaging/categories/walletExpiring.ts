// src/features/core/messaging/categories/walletExpiring.ts
// 上流の種類: 残高の失効が近い(種別 activity)。wallet.expiringNotice(失効の予告。利用者が止められる D67)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "walletExpiring",
  label: "残高の失効が近い",
  description: "残高の有効期限が近づいた時のお知らせ",
  kind: "activity",
  channels: ["email", "inApp"],
};
