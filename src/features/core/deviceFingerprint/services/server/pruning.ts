// src/features/core/deviceFingerprint/services/server/pruning.ts

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { DeviceFingerprintTable } from "@/features/core/deviceFingerprint/entities/drizzle";

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
 * 期限切れフィンガープリント行を削除する。
 *
 * 各行の `retention_days` に基づき
 * `created_at + retention_days * INTERVAL '1 day' < NOW()` を満たす行を削除。
 * userLoginEvent / audit_logs と同じ「バッチ + SKIP LOCKED」パターン。
 *
 * フィンガープリントは IP 同様に個人に紐づく識別情報のため、無期限保持にせず
 * retention で自動削除する。
 */
export async function pruneExpiredDeviceFingerprints(
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
        SELECT id FROM ${DeviceFingerprintTable}
        WHERE ${DeviceFingerprintTable.createdAt} + (${DeviceFingerprintTable.retentionDays} * INTERVAL '1 day') < NOW()
        ORDER BY ${DeviceFingerprintTable.createdAt}
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM ${DeviceFingerprintTable}
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
