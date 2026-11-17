// src/features/core/messaging/templates/announcementRich.ts
// 上流のシステムテンプレート(D117・D119・D125): 種別 announcement の白紙(リッチ)。運営からのお知らせ(全員・ロール・グループ・選んだ利用者へ)。
// ひな形は汎用のお知らせ(notice: 見出し・段落・ボタン・画像・表などのブロックを並べる)。管理画面で直せない・消せない。
// fork は隣の announcementRich.override.ts で label だけ変えられる

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "announcementRich",
  kind: "announcement",
  label: "運営からのお知らせ(リッチ)",
  layout: "notice",
  values: { subject: "", blocks: [] },
};
