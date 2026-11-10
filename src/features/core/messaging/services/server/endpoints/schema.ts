// src/features/core/messaging/services/server/endpoints/schema.ts
//
// 端末の帳簿の登録の入力(どの経路も同じ形。経路ごとの形は後の指令)と、本人へ返す安全な DTO。

import { z } from "zod";

/** metadata の JSON の大きさの上限(バイト) */
const METADATA_MAX_BYTES = 2048;

/** 登録の入力(宛先は経路の中の宛先: プッシュのトークン・電話番号など。秘密は metadata に入れない) */
export const RegisterMessageEndpointInputSchema = z
  .object({
    channel: z.string().trim().min(1).max(64),
    address: z.string().trim().min(1).max(2048),
    /** 宛先の種類(web / ios / android など、経路が決める) */
    kind: z.string().trim().min(1).max(32).optional(),
    /** 付加情報(平らな値だけ。秘密は入れない) */
    metadata: z
      .record(z.string().max(64), z.union([z.string().max(256), z.number(), z.boolean(), z.null()]))
      .optional()
      .refine((value) => !value || JSON.stringify(value).length <= METADATA_MAX_BYTES, {
        message: `metadata は ${METADATA_MAX_BYTES} バイトまで`,
      }),
  })
  .strict();

export type RegisterMessageEndpointInput = z.infer<typeof RegisterMessageEndpointInputSchema>;

/** 本人へ返す端末の帳簿の行(宛先は末尾 6 文字だけ、metadata は返さない) */
export type MessageEndpointDto = {
  id: string;
  channel: string;
  kind: string | null;
  /** 宛先の末尾 6 文字(トークンは持ち主の証になりうるので全体は返さない) */
  addressHint: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};
