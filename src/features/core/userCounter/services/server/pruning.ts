// src/features/core/userCounter/services/server/pruning.ts

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserDailyCounterTable } from "@/features/core/userCounter/entities/drizzle";

/**
 * 1 反復あたりの削除件数。長時間ロックを避けるためのバッチサイズ。
 * 既存の audit_logs / interaction_events プルーニングと同値で揃える。
 */
const DEFAULT_BATCH_SIZE = 1000;

/**
 * 反復回数の上限。1 回の cron 実行で削除しすぎないためのガード。
 * batch_size * max_iterations が 1 回の上限件数になる。
 */
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
 * 期限切れの per-user 日次カウンタを削除する。
 *
 * 各行の `retention_days` に基づき
 * `date + retention_days * INTERVAL '1 day' < NOW()` を満たす行を削除。
 *
 * 累計カウンタ（user_counters）は prune 対象外。合計値は失われない。
 *
 * audit_logs と同じパターン:
 * - batchSize ずつ反復削除して長時間ロックを回避
 * - `FOR UPDATE SKIP LOCKED` で並走 cron / 書き込みと衝突しても進行
 */
export async function pruneExpiredUserDailyCounters(
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
        SELECT id FROM ${UserDailyCounterTable}
        WHERE ${UserDailyCounterTable.date} + (${UserDailyCounterTable.retention_days} * INTERVAL '1 day') < NOW()
        ORDER BY ${UserDailyCounterTable.date}
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM ${UserDailyCounterTable}
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
