// src/features/core/messaging/categories/announcement.ts
// 上流のカテゴリー: 管理画面「一般的なお知らせ」/ 利用者「運営からのお知らせ」(種別 announcement、D124)。自由連絡の告知(白紙のシステムテンプレート templates/announcement.ts)の既定のカテゴリー

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "announcement",
  label: "運営からのお知らせ",
  adminLabel: "一般的なお知らせ",
  description: "メンテナンスや規約の改定など運営からのお知らせ",
  kind: "announcement",
  channels: ["email", "inApp"],
  // 送る画面の送信方法は最初お知らせだけ(メールは送る時に入れる、D119)
  defaultChannels: ["inApp"],
};
