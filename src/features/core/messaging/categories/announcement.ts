// src/features/core/messaging/categories/announcement.ts
// 上流の種類: 運営からのお知らせ(種別 announcement、表示名は仮)。管理者がその場で書く告知 messaging.adminAnnouncement の既定のカテゴリー

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "announcement",
  label: "運営からのお知らせ",
  description: "メンテナンスや規約の改定など運営からのお知らせ",
  kind: "announcement",
  channels: ["email", "inApp"],
};
