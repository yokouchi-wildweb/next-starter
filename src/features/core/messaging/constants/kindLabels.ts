// src/features/core/messaging/constants/kindLabels.ts
//
// 種別(kind)の利用者向けの表示名(好みのページの種別の枠の見出し)。
// 名前は仮: 種別の表示名の見直しは計画書の OUT_OF_SCOPE(後の回で lib の種別の表か config へ移す)。並びは lib の MESSAGE_KINDS

import type { MessageKind } from "@/lib/messaging";

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  functional: "サービスの機能の連絡",
  transactional: "お手続きのお知らせ",
  security: "セキュリティのお知らせ",
  announcement: "運営からのお知らせ",
  direct: "運営からの個別の連絡",
  activity: "ご利用に伴うお知らせ",
  marketing: "キャンペーン情報",
};
