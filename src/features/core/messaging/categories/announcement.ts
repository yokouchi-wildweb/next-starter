// src/features/core/messaging/categories/announcement.ts
// 上流の種類: 運営からのお知らせ(種別 announcement、表示名は仮)。管理者がその場で書く告知(白紙のシステムテンプレート templates/announcement.ts)の既定のカテゴリー

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "announcement",
  label: "運営からのお知らせ",
  description: "メンテナンスや規約の改定など運営からのお知らせ",
  kind: "announcement",
  channels: ["email", "inApp"],
  // 送る画面の送信方法は最初お知らせだけ(メールは送る時に入れる、D119)
  defaultChannels: ["inApp"],
};
