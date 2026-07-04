// src/features/core/interactionTracking/entities/schema.ts

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

/**
 * 公開 ingest ルート（POST /api/interactions）の入力スキーマ。
 *
 * - 各値に長さ上限を設ける（ゴミデータ・肥大化対策）。語彙の採番は消費側の責務
 * - metadata / retentionDays / userId は公開入力として受け付けない
 *   （userId はセッションから自動付与、その他はサーバー内部 record() 専用）
 */
export const InteractionIngestSchema = z.object({
  targetType: z.string().trim().min(1).max(100),
  targetId: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(100),
  source: z.string().trim().min(1).max(100).optional(),
});

export type InteractionIngestInput = z.infer<typeof InteractionIngestSchema>;

/**
 * バッチ ingest ルート（POST /api/interactions/batch）の入力スキーマ。
 *
 * インプレッション等の高頻度イベント用。クライアント側で集約済みの
 * (target × action × source) → count を最大 100 エントリまで一括送信する。
 * - count はエントリあたり 1〜100 に制限（水増し・肥大化対策）
 * - 受け付ける action は registry の batchActions で明示された語彙のみ（fail-closed）
 */
export const InteractionBatchEntrySchema = z.object({
  targetType: z.string().trim().min(1).max(100),
  targetId: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(100),
  source: z.string().trim().min(1).max(100).optional(),
  count: z.coerce.number().int().min(1).max(100),
});

export const InteractionBatchIngestSchema = z.object({
  events: z.array(InteractionBatchEntrySchema).min(1).max(100),
});

export type InteractionBatchEntry = z.infer<typeof InteractionBatchEntrySchema>;
export type InteractionBatchIngestInput = z.infer<typeof InteractionBatchIngestSchema>;
