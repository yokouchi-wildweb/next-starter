// src/features/core/fingerprintChallenge/services/server/pruning.ts

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { FingerprintChallengeAccessEventTable } from "@/features/core/fingerprintChallenge/entities/drizzle";

/** 1 反復あたりの削除件数。長時間ロックを避けるためのバッチサイズ (audit_logs と同値) */
const DEFAULT_BATCH_SIZE = 1000;

/** 反復回数の上限。1 回の cron 実行で削除しすぎないためのガード */
const DEFAULT_MAX_ITERATIONS = 100;

export type PruneOptions = {
  batchSize?: number;
  maxIterations?: number;
};

export type PruneResult = {
  deletedCount: number;
  iterations: number;
  /** 上限到達で打ち切られた場合 true (次回 cron で残りを処理) */
  truncated: boolean;
};

/**
 * 期限切れのチャレンジアクセスイベントを削除する。
 *
 * 各行の `retention_days` に基づき
 * `accessed_at + retention_days * INTERVAL '1 day' < NOW()` を満たす行を削除。
 * userLoginEvent / deviceFingerprint と同じ「バッチ + SKIP LOCKED」パターン。
 *
 * 親行 (fingerprint_challenges) の first/last_viewed_at / view_count は集計値として残す
 * (PII を含まない)。削除対象は IP + UA を持つ詳細行のみ。
 * accessLog 未使用の環境では対象が存在せず no-op。
 */
export async function pruneExpiredChallengeAccessEvents(
  options: PruneOptions = {},
): Promise<PruneResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  let deletedCount = 0;
  let iterations = 0;
  let lastBatchSize = batchSize;

  while (iterations < maxIterations && lastBatchSize === batchSize) {
    const result = (await db.execute(sql`
      WITH expired AS (
        SELECT id FROM ${FingerprintChallengeAccessEventTable}
        WHERE ${FingerprintChallengeAccessEventTable.accessedAt} + (${FingerprintChallengeAccessEventTable.retentionDays} * INTERVAL '1 day') < NOW()
        ORDER BY ${FingerprintChallengeAccessEventTable.accessedAt}
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM ${FingerprintChallengeAccessEventTable}
      WHERE id IN (SELECT id FROM expired)
      RETURNING id
    `)) as Array<{ id: string }>;

    lastBatchSize = result.length;
    deletedCount += lastBatchSize;
    iterations += 1;

    if (lastBatchSize === 0) break;
  }

  const truncated = iterations >= maxIterations && lastBatchSize === batchSize;

  return { deletedCount, iterations, truncated };
}
