// src/features/core/messaging/services/server/preferences/schema.ts
//
// 好みを変える入力の zod。
// - マス / 全体: { category, channel, optedOut }。全体は category と channel のどちらも '*'。片方だけの '*' は受けない
// - 種別まるごと: { kind, optedOut }(種別が利用者の止められる種別かは service が見る)

import { z } from "zod";

import { MESSAGE_ALL } from "../../../entities/schema";

const CellInputSchema = z
  .object({
    category: z.string().min(1).max(100),
    channel: z.string().min(1).max(100),
    optedOut: z.boolean(),
  })
  .strict()
  .refine((value) => (value.category === MESSAGE_ALL) === (value.channel === MESSAGE_ALL), {
    message: "全体の停止は category と channel のどちらも '*' にします",
  });

const KindInputSchema = z
  .object({
    kind: z.string().min(1).max(100),
    optedOut: z.boolean(),
  })
  .strict();

export const SetMessagePreferenceInputSchema = z.union([CellInputSchema, KindInputSchema]);

/** 書いた入口(サーバーの呼び手の値) */
export const MessagePreferenceSourceSchema = z.string().min(1).max(100);
