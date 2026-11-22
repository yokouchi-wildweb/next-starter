// src/domains/core/wallet/plugs/messagingCategories/walletAdjusted.ts
// 上流のカテゴリー: 残高の調整(種別 transactional)。wallet.adjustmentNotice

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "walletAdjusted",
  label: "残高の調整",
  description: "運営が残高を調整した時のお知らせ",
  kind: "transactional",
  channels: ["inApp"],
};
