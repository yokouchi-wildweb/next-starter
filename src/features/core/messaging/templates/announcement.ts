// src/features/core/messaging/templates/announcement.ts
// 上流のシステムテンプレート(D117・D125): 種別 announcement の白紙。運営からのお知らせ(全員・ロール・グループ・選んだ利用者へ)。
// ひな形は汎用のお知らせ(notice)。管理画面で直せない・消せない。fork は隣の announcement.override.ts で label だけ変えられる

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "announcement",
  kind: "announcement",
  label: "運営からのお知らせ(白紙)",
  layout: "notice",
  values: { subject: "", blocks: [] },
};
