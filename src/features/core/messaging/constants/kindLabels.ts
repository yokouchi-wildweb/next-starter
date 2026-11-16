// src/features/core/messaging/constants/kindLabels.ts
//
// 種別(kind)の表示名(D81。好みのページの種別の枠の見出し・管理画面の種別)。並びは lib の MESSAGE_KINDS

import type { MessageKind } from "@/lib/messaging";

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  functional: "機能通知",
  transactional: "手続き通知",
  security: "セキュリティ",
  announcement: "運営告知",
  direct: "個別連絡",
  activity: "アクティビティ",
  promotion: "プロモーション",
};
