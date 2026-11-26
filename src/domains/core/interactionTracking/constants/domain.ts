// src/domains/core/interactionTracking/constants/domain.ts
// どの表にも属さないドメイン全体の定数と入力の形(entities/<登録名>/ にはその表の物だけ)

import { z } from "zod";

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
