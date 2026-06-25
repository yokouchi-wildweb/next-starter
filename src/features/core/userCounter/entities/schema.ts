// src/features/core/userCounter/entities/schema.ts

import { z } from "zod";

/**
 * 汎用カウンタの Zod スキーマ。
 *
 * 主たる書き込み経路は counterService.bump（原子加算）であり、これらは
 * serviceRegistry 経由の admin 汎用 CRUD（手動補正・登録）用の最小スキーマ。
 * first/last_occurred_at はサーバ管理のためスキーマには含めない（DB default 任せ）。
 */
export const UserCounterBaseSchema = z.object({
  user_id: z.string().trim().min(1, { message: "ユーザーIDは必須です。" }),
  counter_key: z.string().trim().min(1, { message: "カウンタキーは必須です。" }),
  count: z.coerce.number().int().default(0),
});

export const UserCounterCreateSchema = UserCounterBaseSchema;

export const UserCounterUpdateSchema = UserCounterBaseSchema.partial();
