// src/features/core/messaging/templates/directRich.ts
// 上流のシステムテンプレート(D117・D119・D125): 種別 direct の白紙(リッチ)。運営から特定の利用者への個別の連絡(選んだ利用者・グループ・一括送信)。
// ひな形は汎用のお知らせ(notice: 見出し・段落・ボタン・画像・表などのブロックを並べる)。管理画面で直せない・消せない。
// fork は隣の directRich.override.ts で label と enabled(false = 使わない、D122)だけ変えられる

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "directRich",
  kind: "direct",
  label: "個別のご連絡(リッチ)",
  layout: "notice",
  values: { subject: "", blocks: [] },
};
