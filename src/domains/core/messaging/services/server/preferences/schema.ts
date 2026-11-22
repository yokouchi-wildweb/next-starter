// src/domains/core/messaging/services/server/preferences/schema.ts
//
// 好みを変える入力の zod。
// - { category, channel, optedOut }: 1 マス / カテゴリーまるごと(channel '*')/ 送信チャンネルまるごと(category '*')/ 全体(どちらも '*')。
//   カテゴリーが利用者の止められるカテゴリーか・送信チャンネルが開いているかは service が見る
// - 種別まるごと: { kind, optedOut }(種別が利用者の止められる種別かは service が見る)
// - グループまるごと: { group, channel?, optedOut }(channel 省略 = '*' = 全送信チャンネル。グループに利用者の止められるカテゴリーがあるかは service が見る、D123)

import { z } from "zod";

const CellInputSchema = z
  .object({
    category: z.string().min(1).max(100),
    channel: z.string().min(1).max(100),
    optedOut: z.boolean(),
  })
  .strict();

const KindInputSchema = z
  .object({
    kind: z.string().min(1).max(100),
    optedOut: z.boolean(),
  })
  .strict();

const GroupInputSchema = z
  .object({
    group: z.string().min(1).max(100),
    channel: z.string().min(1).max(100).optional(),
    optedOut: z.boolean(),
  })
  .strict();

export const SetMessagePreferenceInputSchema = z.union([CellInputSchema, KindInputSchema, GroupInputSchema]);

/** 書いた入口(サーバーの呼び手の値) */
export const MessagePreferenceSourceSchema = z.string().min(1).max(100);
