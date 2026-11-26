// src/domains/core/interactionTracking/entities/interactionEvent/schema.ts

import { z } from "zod";

/**
 * インタラクションイベントの Zod スキーマ。
 *
 * 主たる書き込み経路は interactionService.record（イベント挿入 + カウンタ原子加算）。
 * Create/Update スキーマは serviceRegistry 経由の admin 汎用 CRUD（調査・手動補正）用の
 * 最小スキーマ。汎用 CRUD での直接挿入はカウンタを加算しない点に注意（README 参照）。
 */
export const InteractionEventBaseSchema = z.object({
  targetType: z.string().trim().min(1, { message: "対象種別は必須です。" }),
  targetId: z.string().trim().min(1, { message: "対象IDは必須です。" }),
  action: z.string().trim().min(1, { message: "アクションは必須です。" }),
  source: z.string().trim().min(1).nullish(),
  userId: z.string().uuid().nullish(),
  retentionDays: z.coerce.number().int().positive(),
});
export const InteractionEventCreateSchema = InteractionEventBaseSchema;
export const InteractionEventUpdateSchema = InteractionEventBaseSchema.partial();
