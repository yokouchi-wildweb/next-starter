// src/features/core/messaging/templates/announcement.ts
// 上流のシステムテンプレート(D117・D119・D125): 種別 announcement の白紙(シンプル)。運営からのお知らせ(全員・ロール・グループ・選んだ利用者へ)。
// ひな形はシンプルなお知らせ(simple)。種別の既定の白紙(受け口の順でこの種別の使う物の最初)。管理画面で直せない・消せない。
// fork は隣の announcement.override.ts で label と enabled(false = 使わない、D122)だけ変えられる。ブロックを並べるリッチな白紙は ./announcementRich.ts

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "announcement",
  kind: "announcement",
  label: "一般的なお知らせ_シンプル",
  layout: "simple",
  values: { subject: "" },
};
