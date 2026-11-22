// src/domains/core/messaging/layouts/simple/layout.ts
// 上流のレイアウト「シンプル」(D119): 件名・サムネイル・本文・リンクのボタン。本文は必須、件名はメールを送る時だけ必須(D211)、サムネイル・ボタンは任意(空 = 無い、D128)。管理者がテンプレートで選べる。
// 要約: 題 = 件名(無ければ本文の頭、summaryTitle)/ 本文 = 本文 / 画像 = サムネイル / 行き先 = リンクのボタン

import { defineMessageLayout, summaryTitle } from "@/lib/messaging";

export const layout = defineMessageLayout({
  key: "simple",
  label: "シンプル",
  description: "件名・サムネイル・本文・リンクのボタンだけの、短いお知らせ",
  adminSelectable: true,
  fields: {
    subject: { type: "line", label: "件名", placeholder: "例: 新しい機能のお知らせ", requiredFor: ["email"] },
    image: { type: "image", label: "サムネイル" },
    body: { type: "paragraph", label: "本文", placeholder: "例: いつもご利用ありがとうございます。…", required: true },
    link: { type: "button", label: "リンクのボタン", placeholder: "例: 詳しく見る" },
  },
  summary: (values) => ({
    title: summaryTitle(values.subject, values.body),
    body: values.body ?? "",
    ...(values.image ? { image: values.image } : {}),
    ...(values.link ? { link: { label: values.link.label, url: values.link.url } } : {}),
  }),
});

export type SimpleValues = Parameters<typeof layout.summary>[0];
