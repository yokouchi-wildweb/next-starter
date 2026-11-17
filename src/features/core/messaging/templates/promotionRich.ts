// src/features/core/messaging/templates/promotionRich.ts
// 上流のシステムテンプレート(D117・D119・D125): 種別 promotion の白紙(リッチ)。宣伝(利用者が止められる。全部の宛先へ)。
// ひな形は汎用のお知らせ(notice: 見出し・段落・ボタン・画像・表などのブロックを並べる)。管理画面で直せない・消せない。
// fork は隣の promotionRich.override.ts で label だけ変えられる

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "promotionRich",
  kind: "promotion",
  label: "キャンペーン(リッチ)",
  layout: "notice",
  values: { subject: "", blocks: [] },
};
