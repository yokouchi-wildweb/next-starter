// src/features/core/messaging/layouts/simple/layout.ts
// 上流のレイアウト「シンプルなお知らせ」(D119): 件名・サムネイル・本文・リンクのボタン。件名・本文は必須、サムネイル・ボタンは任意(空 = 無い、D128)。管理者がテンプレートで選べる(管理の 3 種別の既定の白紙)。
// 要約: 題 = 件名 / 本文 = 本文 / 画像 = サムネイル / 行き先 = リンクのボタン

import { defineMessageLayout } from "@/lib/messaging";

export const layout = defineMessageLayout({
  key: "simple",
  label: "シンプルなお知らせ",
  description: "件名・サムネイル・本文・リンクのボタンだけの、短いお知らせ",
  adminSelectable: true,
  fields: {
    subject: { type: "line", label: "件名", placeholder: "例: 新しい機能のお知らせ", required: true },
    image: { type: "image", label: "サムネイル" },
    body: { type: "paragraph", label: "本文", placeholder: "例: いつもご利用ありがとうございます。…", required: true },
    link: { type: "button", label: "リンクのボタン", placeholder: "例: 詳しく見る" },
  },
  summary: (values) => ({
    title: values.subject ?? "",
    body: values.body ?? "",
    ...(values.image ? { image: values.image } : {}),
    ...(values.link ? { link: { label: values.link.label, url: values.link.url } } : {}),
  }),
});

export type SimpleValues = Parameters<typeof layout.summary>[0];
