// src/features/core/messaging/templates/maintenance.ts
// 上流のシステムテンプレート(D119): 種別 announcement の「メンテナンスのお知らせ」。ひな形はシンプルなお知らせ(simple)。
// 文面はできあがった形で、専用の埋め込み情報 開始日時(startAt)・終了日時(endAt)を送る人が送る時に入れる(日時、必須。
// 差し込む時は「2026年12月1日 11:00」の形になる)。管理画面で直せない・消せない(送る画面で文面は直せる)。fork は maintenance.override.ts で label だけ

import type { MessageSystemTemplate } from "@/lib/messaging";

export const systemTemplate: MessageSystemTemplate = {
  key: "maintenance",
  kind: "announcement",
  label: "メンテナンスのお知らせ",
  layout: "simple",
  values: {
    subject: "メンテナンスのお知らせ",
    body: "いつもご利用いただきありがとうございます。\n\n下記の日時にメンテナンスを行います。\n開始: {{開始日時}}\n終了: {{終了日時}}\n\nメンテナンスの間はサービスをご利用いただけません。ご不便をおかけしますが、ご理解のほどよろしくお願いいたします。",
  },
  embedded: [
    { key: "startAt", alias: "開始日時", type: "datetime", required: true },
    { key: "endAt", alias: "終了日時", type: "datetime", required: true },
  ],
};
