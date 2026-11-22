// src/features/core/messaging/templates/direct.ts
// 上流のシステムテンプレート(D117・D119・D125): 種別 direct の白紙(シンプル)。運営から特定の利用者への個別の連絡(選んだ利用者・グループ・一括送信)。
// レイアウトはシンプルなお知らせ(simple)。種別の既定の白紙(受け口の順でこの種別の使う物の最初)。管理画面で直せない・消せない。
// fork は隣の direct.override.ts で label と enabled(false = 使わない、D122)だけ変えられる。ブロックを並べるリッチな白紙は ./directRich.ts

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "direct",
  kind: "direct",
  label: "一般的な個別連絡_シンプル",
  layout: "simple",
  values: { subject: "" },
};
