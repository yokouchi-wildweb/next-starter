// src/lib/messaging/definition/channels.ts
//
// 経路ごとの名前付きの欄(管理画面の文言の編集・テンプレートの文面・管理の送信の文面が使う。連絡の定義はひな形 + 欄の中身で、これを持たない)。
// 上流の経路は email・inApp・line。fork の経路は経路の受け口(S6 の生成の一覧)で欄の zod を足し、
// 型の引数 Channels に渡す。

import { z } from "zod";

/** メールの欄(管理画面の文言の編集とテンプレートが読む。送る口は読まない: 描き方はひな形、S5 で消す) */
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

/** メールの欄の値 */
export type EmailFields = z.infer<typeof emailFieldsSchema>;

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

