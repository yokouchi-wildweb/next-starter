// src/features/core/messaging/categories/promotion.ts
// 上流のカテゴリー「キャンペーン情報」(種別 promotion、D124。管理画面だけの名前 adminLabel は持たない、D185)。自由連絡の宣伝の既定のカテゴリー

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "promotion",
  label: "キャンペーン情報",
  description: "新しい機能やキャンペーンなどのお知らせ",
  kind: "promotion",
  channels: ["email", "inApp"],
  // 送る画面の送信方法は最初お知らせだけ(メールは送る時に入れる、D119)
  defaultChannels: ["inApp"],
};
