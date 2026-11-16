// src/features/core/messaging/layouts/statement/layout.ts
// 上流のひな形「お知らせの明細」(D122・D123): 札・宛名・本文の知らせ(財布の失効の予告・本通知など)。コードの連絡だけが使う(adminSelectable false)。
// 要約: 題 = 件名 / 本文 = 本文 / 短い本文 = プレビューの文

import { defineMessageLayout } from "@/lib/messaging";

export const layout = defineMessageLayout({
  key: "statement",
  label: "お知らせの明細",
  description: "ロゴと札・宛名・本文(改行はそのまま)を出す、明細のお知らせ",
  adminSelectable: false,
  fields: {
    subject: { type: "line", label: "件名", required: true },
    preheader: { type: "line", label: "プレビューの文" },
    badge: { type: "line", label: "ロゴの下の札" },
    addressee: { type: "line", label: "宛名" },
    body: { type: "longText", label: "本文", required: true },
    footer: { type: "paragraph", label: "末尾の注意書き" },
  },
  summary: (values) => ({
    title: values.subject ?? "",
    body: values.body ?? "",
    ...(values.preheader ? { shortBody: values.preheader } : {}),
  }),
});

export type StatementValues = Parameters<typeof layout.summary>[0];
