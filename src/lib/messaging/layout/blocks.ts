// src/lib/messaging/layout/blocks.ts
//
// ブロックの並び(D123)の型つきのブロック。管理者が書く汎用のひな形の本文はこの並び。
// 種類は lib で固定(fork は増やさない。描き方は経路の汎用の描き方とひな形の描き方が種類ごとに持つ)。

import { z } from "zod";

/** ブロックの種類(並びは画面の選択肢の順) */
export const MESSAGE_BLOCK_KINDS = [
  "heading",
  "paragraph",
  "button",
  "image",
  "divider",
  "keyValueTable",
  "bulletList",
] as const;

export type MessageBlockKind = (typeof MESSAGE_BLOCK_KINDS)[number];

/** ブロックの種類の表示名(管理画面の選択肢) */
export const MESSAGE_BLOCK_KIND_LABELS: Readonly<Record<MessageBlockKind, string>> = {
  heading: "小見出し",
  paragraph: "段落",
  button: "ボタン",
  image: "画像",
  divider: "区切り",
  keyValueTable: "項目と値の表",
  bulletList: "箇条書き",
};

const text = z.string().min(1);

/** ブロックごとの zod(type で分ける) */
export const MESSAGE_BLOCK_SCHEMAS = {
  heading: z.object({ type: z.literal("heading"), text }).strict(),
  paragraph: z.object({ type: z.literal("paragraph"), text }).strict(),
  button: z.object({ type: z.literal("button"), label: text, url: text }).strict(),
  /** src = storage:// の参照か URL */
  image: z.object({ type: z.literal("image"), src: text, alt: z.string().optional() }).strict(),
  divider: z.object({ type: z.literal("divider") }).strict(),
  keyValueTable: z
    .object({ type: z.literal("keyValueTable"), rows: z.array(z.object({ key: text, value: z.string() }).strict()).min(1) })
    .strict(),
  bulletList: z.object({ type: z.literal("bulletList"), items: z.array(text).min(1) }).strict(),
} as const;

export type MessageBlock = { [K in MessageBlockKind]: z.infer<(typeof MESSAGE_BLOCK_SCHEMAS)[K]> }[MessageBlockKind];

/** ブロック 1 つの zod(知らない種類は通らない) */
export const messageBlockSchema = z.discriminatedUnion("type", [
  MESSAGE_BLOCK_SCHEMAS.heading,
  MESSAGE_BLOCK_SCHEMAS.paragraph,
  MESSAGE_BLOCK_SCHEMAS.button,
  MESSAGE_BLOCK_SCHEMAS.image,
  MESSAGE_BLOCK_SCHEMAS.divider,
  MESSAGE_BLOCK_SCHEMAS.keyValueTable,
  MESSAGE_BLOCK_SCHEMAS.bulletList,
]);

/** ブロックの並びの欄の絞り(D123): 許す種類・数 */
export type MessageBlocksConstraint = { allow?: readonly MessageBlockKind[]; min?: number; max?: number };

/** ブロックの並びの zod(allow の外の種類・min / max の外の数は通らない) */
export function messageBlocksSchema(constraint: MessageBlocksConstraint = {}) {
  let schema = z.array(messageBlockSchema);
  if (constraint.min !== undefined) schema = schema.min(constraint.min, `ブロックは ${constraint.min} 個以上にしてください`);
  if (constraint.max !== undefined) schema = schema.max(constraint.max, `ブロックは ${constraint.max} 個までにしてください`);
  const allow = constraint.allow;
  if (!allow) return schema;
  return schema.superRefine((blocks, ctx) => {
    blocks.forEach((block, index) => {
      if (!allow.includes(block.type)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "type"], message: `この欄では「${MESSAGE_BLOCK_KIND_LABELS[block.type]}」は使えません` });
      }
    });
  });
}
