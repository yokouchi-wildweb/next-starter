// src/features/core/messaging/layouts/notice/layout.ts
// 上流のひな形「汎用のお知らせ」(D122・D123): 件名 + ブロックの並び。管理者がテンプレートで選べる。
// 要約: 題 = 件名 / 本文 = 段落のブロックをつないだ文 / 画像 = 最初の画像のブロック / 行き先 = 最初のボタンのブロック

import { defineMessageLayout, MESSAGE_BLOCK_KINDS, type MessageBlock } from "@/lib/messaging";

/** 要約の本文・画像・行き先をブロックの並びから引く */
export function summarizeBlocks(blocks: readonly MessageBlock[]) {
  const paragraphs = blocks.flatMap((block) => (block.type === "paragraph" ? [block.text] : []));
  const image = blocks.find((block) => block.type === "image");
  const button = blocks.find((block) => block.type === "button");
  return {
    body: paragraphs.join("\n\n"),
    ...(image?.type === "image" ? { image: image.src } : {}),
    ...(button?.type === "button" ? { link: { label: button.label, url: button.url } } : {}),
  };
}

export const layout = defineMessageLayout({
  key: "notice",
  label: "汎用のお知らせ",
  description: "件名と、見出し・段落・ボタン・画像などのブロックを並べて書くお知らせ",
  adminSelectable: true,
  fields: {
    subject: { type: "line", label: "件名", placeholder: "例: メンテナンスのお知らせ", required: true },
    blocks: { type: "blocks", label: "本文", required: true, allow: MESSAGE_BLOCK_KINDS },
  },
  summary: (values) => ({ title: values.subject ?? "", ...summarizeBlocks(values.blocks ?? []) }),
});
