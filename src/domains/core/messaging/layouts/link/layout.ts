// src/domains/core/messaging/layouts/link/layout.ts
// 上流のレイアウト「認証のリンク」(D122・D123): リンクを押してもらう認証のメール(確認・事前登録・パスワードの再設定・メールアドレスの変更)。
// 定義連絡だけが使う(adminSelectable false)。件名はメールを送る時だけ必須(D211)。要約: 題 = 件名(無ければ本文の頭、summaryTitle)/ 本文 = 受付の文 + ボタンの案内 / 行き先 = ボタン / 短い本文 = プレビューの文

import { defineMessageLayout, summaryTitle } from "@/lib/messaging";

export const layout = defineMessageLayout({
  key: "link",
  label: "認証のリンク",
  description: "見出し・受付の文・ボタン・URL の案内と URL をそのまま出す、リンクを押してもらう認証のメール",
  adminSelectable: false,
  fields: {
    subject: { type: "line", label: "件名", requiredFor: ["email"] },
    preheader: { type: "line", label: "プレビューの文" },
    heading: { type: "line", label: "見出し", required: true },
    received: { type: "paragraph", label: "受付の文", required: true },
    buttonGuide: { type: "paragraph", label: "ボタンの案内" },
    button: { type: "button", label: "ボタン", required: true },
    urlGuide: { type: "paragraph", label: "URL の案内" },
    footer: { type: "paragraph", label: "末尾の注意書き" },
  },
  summary: (values) => {
    const body = [values.received, values.buttonGuide].filter(Boolean).join("\n\n");
    return {
      title: summaryTitle(values.subject, body),
      body,
      ...(values.button ? { link: { label: values.button.label, url: values.button.url } } : {}),
      ...(values.preheader ? { shortBody: values.preheader } : {}),
    };
  },
});

export type LinkValues = Parameters<typeof layout.summary>[0];
