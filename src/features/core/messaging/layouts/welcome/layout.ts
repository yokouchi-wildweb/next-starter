// src/features/core/messaging/layouts/welcome/layout.ts
// 上流のレイアウト「ようこそ」(D122・D123): 登録の完了の知らせ(会員登録・事前登録)。定義連絡だけが使う(adminSelectable false)。
// 要約: 題 = 件名 / 本文 = お礼 + 案内 / 行き先 = ボタン(あれば)/ 短い本文 = プレビューの文

import { defineMessageLayout } from "@/lib/messaging";

export const layout = defineMessageLayout({
  key: "welcome",
  label: "ようこそ",
  description: "ロゴと札・お祝いの見出し・お礼・案内・ボタンを出す、登録の完了の知らせ",
  adminSelectable: false,
  fields: {
    subject: { type: "line", label: "件名", required: true },
    preheader: { type: "line", label: "プレビューの文" },
    badge: { type: "line", label: "ロゴの下の札" },
    heading: { type: "line", label: "お祝いの見出し", required: true },
    thanks: { type: "paragraph", label: "お礼", required: true },
    guide: { type: "paragraph", label: "案内" },
    button: { type: "button", label: "ボタン" },
    footer: { type: "paragraph", label: "末尾の注意書き" },
  },
  summary: (values) => ({
    title: values.subject ?? "",
    body: [values.thanks, values.guide].filter(Boolean).join("\n\n"),
    ...(values.button ? { link: { label: values.button.label, url: values.button.url } } : {}),
    ...(values.preheader ? { shortBody: values.preheader } : {}),
  }),
});

export type WelcomeValues = Parameters<typeof layout.summary>[0];
