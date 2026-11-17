// src/features/core/messaging/templates/promotion.ts
// 上流のシステムテンプレート(D117・D119・D125): 種別 promotion の白紙(シンプル)。宣伝(利用者が止められる。全部の宛先へ)。
// ひな形はシンプルなお知らせ(simple)。種別の既定の白紙(受け口の順でこの種別の使う物の最初)。管理画面で直せない・消せない。
// fork は隣の promotion.override.ts で label と enabled(false = 使わない、D122)だけ変えられる。ブロックを並べるリッチな白紙は ./promotionRich.ts

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "promotion",
  kind: "promotion",
  label: "キャンペーン(シンプル)",
  layout: "simple",
  values: { subject: "" },
};
