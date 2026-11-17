// src/features/core/messaging/templates/promotion.ts
// 上流のシステムテンプレート(D117・D125): 種別 promotion の白紙。宣伝(利用者が止められる。全部の宛先へ)。
// ひな形は汎用のお知らせ(notice)。管理画面で直せない・消せない。fork は隣の promotion.override.ts で label だけ変えられる

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "promotion",
  kind: "promotion",
  label: "キャンペーン(白紙)",
  layout: "notice",
  values: { subject: "", blocks: [] },
};
