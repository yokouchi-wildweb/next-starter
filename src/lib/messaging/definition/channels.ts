// src/lib/messaging/definition/channels.ts
//
// 経路ごとの名前付きの欄(連絡の定義の content)。欄の値は文字列で、{{鍵}} を差し込める。
// 上流の経路は email・inApp・line。fork の経路は経路の受け口(S6 の生成の一覧)で欄の zod を足し、
// 型の引数 Channels に渡す。

import { z } from "zod";

/** メールの欄(描き方は messages/views の部品。欄の文言は管理画面と override で直せる) */
export const emailFieldsSchema = z
  .object({
    subject: z.string().min(1),
    preheader: z.string().optional(),
    heading: z.string().optional(),
    paragraphs: z.array(z.string()).optional(),
    cta: z.object({ label: z.string().min(1), url: z.string().min(1) }).strict().optional(),
    footer: z.string().optional(),
  })
  .strict();

/** お知らせ(受け取り箱)の欄。見た目は受け取り箱の画面の部品が決める */
export const inAppFieldsSchema = z
  .object({
    title: z.string().min(1),
    body: z.string(),
    /** 画像(storage:// の参照か URL) */
    image: z.string().optional(),
    /** 押したときの行き先 */
    link: z.string().optional(),
  })
  .strict();

/** LINE の欄 */
export const lineFieldsSchema = z
  .object({
    text: z.string().min(1),
  })
  .strict();

/** 上流の経路の欄 */
export const UPSTREAM_CHANNEL_FIELDS = {
  email: emailFieldsSchema,
  inApp: inAppFieldsSchema,
  line: lineFieldsSchema,
} as const;

/** 経路の鍵 → 欄の zod の束 */
export type ChannelFieldSchemas = Record<string, z.ZodTypeAny>;

export type UpstreamChannelFields = typeof UPSTREAM_CHANNEL_FIELDS;

/** 連絡の中身 = 経路の鍵の Record(連絡が使わない経路は省く) */
export type MessageContent<C extends ChannelFieldSchemas = UpstreamChannelFields> = {
  [K in keyof C]?: z.input<C[K]>;
};

/** 欄の名前(`<経路>.<欄>`)。adminEditable が使う */
export type MessageFieldPath<C extends ChannelFieldSchemas = UpstreamChannelFields> = {
  [K in keyof C & string]: `${K}.${keyof z.input<C[K]> & string}`;
}[keyof C & string];
