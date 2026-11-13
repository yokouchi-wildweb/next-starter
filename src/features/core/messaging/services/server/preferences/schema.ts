// src/features/core/messaging/services/server/preferences/schema.ts
//
// 好みを変える入力の zod。
// - { category, channel, optedOut }: 1 マス / 種類まるごと(channel '*')/ 経路まるごと(category '*')/ 全体(どちらも '*')。
//   種類が利用者の止められる種類か・経路が開いているかは service が見る
// - 種別まるごと: { kind, optedOut }(種別が利用者の止められる種別かは service が見る)

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

export const SetMessagePreferenceInputSchema = z.union([CellInputSchema, KindInputSchema]);

/** 書いた入口(サーバーの呼び手の値) */
export const MessagePreferenceSourceSchema = z.string().min(1).max(100);
