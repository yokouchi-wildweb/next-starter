// src/features/core/userLoginEvent/services/server/pruning.ts

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserLoginEventTable } from "@/features/core/userLoginEvent/entities/drizzle";

/**
 * 1 反復あたりの削除件数。長時間ロックを避けるためのバッチサイズ。
 * 既存の audit_logs プルーニングと同値で揃える。
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
 * 期限切れログインイベントを削除する。
 *
 * 各行の `retention_days` に基づき
 * `created_at + retention_days * INTERVAL '1 day' < NOW()` を満たす行を削除。
 *
 * audit_logs と同じパターン:
 * - batchSize ずつ反復削除して長時間ロックを回避
 * - `FOR UPDATE SKIP LOCKED` で並走 cron / 書き込みと衝突しても進行
 *
 * 将来テーブルが極大化した場合はパーティショニング (PARTITION BY RANGE created_at)
 * 導入を検討する。本関数はその移行までの実装。
 */
export async function pruneExpiredUserLoginEvents(
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
        SELECT id FROM ${UserLoginEventTable}
        WHERE ${UserLoginEventTable.createdAt} + (${UserLoginEventTable.retentionDays} * INTERVAL '1 day') < NOW()
        ORDER BY ${UserLoginEventTable.createdAt}
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM ${UserLoginEventTable}
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
