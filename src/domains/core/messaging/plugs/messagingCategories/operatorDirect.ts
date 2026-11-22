// src/domains/core/messaging/plugs/messagingCategories/operatorDirect.ts
// 上流のカテゴリー「個別のご連絡」(種別 direct、D124。管理画面だけの名前 adminLabel は持たない、D185)。個別の自由連絡の既定のカテゴリー(一覧の一括操作の既定、D81)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "operatorDirect",
  label: "個別のご連絡",
  description: "運営からあなたへの個別のご連絡",
  kind: "direct",
  channels: ["email", "inApp"],
  // 送る画面の送信方法は最初お知らせだけ(メールは送る時に入れる、D119)
  defaultChannels: ["inApp"],
};
