// src/features/core/messaging/categories/operatorDirect.ts
// 上流のカテゴリー: 管理画面「一般的な個別連絡」/ 利用者「個別のご連絡」(種別 direct、D124)。個別の自由連絡(白紙のシステムテンプレート templates/direct.ts)の既定のカテゴリー(一覧の一括操作の既定、D81)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "operatorDirect",
  label: "個別のご連絡",
  adminLabel: "一般的な個別連絡",
  description: "運営からあなたへの個別のご連絡",
  kind: "direct",
  channels: ["email", "inApp"],
  // 送る画面の送信方法は最初お知らせだけ(メールは送る時に入れる、D119)
  defaultChannels: ["inApp"],
};
