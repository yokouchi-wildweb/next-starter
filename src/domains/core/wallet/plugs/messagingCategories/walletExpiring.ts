// src/domains/core/wallet/plugs/messagingCategories/walletExpiring.ts
// 上流のカテゴリー: 残高の失効が近い(種別 transactional、利用者は止められない D207・D208)。wallet.expiringNotice(失効の予告)。
// 送るか・いつ送るかは wallet の config の段(expiration[<通貨>].notice.preExpiry)が決める

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "walletExpiring",
  label: "残高の失効が近い",
  description: "残高の有効期限が近づいた時のお知らせ",
  kind: "transactional",
  channels: ["email", "inApp"],
};
