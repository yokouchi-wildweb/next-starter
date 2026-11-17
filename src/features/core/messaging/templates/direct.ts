// src/features/core/messaging/templates/direct.ts
// 上流のシステムテンプレート(D117・D125): 種別 direct の白紙。運営から特定の利用者への個別の連絡(選んだ利用者・一括送信)。
// ひな形は汎用のお知らせ(notice)。管理画面で直せない・消せない。fork は隣の direct.override.ts で label だけ変えられる

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "direct",
  kind: "direct",
  label: "個別のご連絡(白紙)",
  layout: "notice",
  values: { subject: "", blocks: [] },
};
