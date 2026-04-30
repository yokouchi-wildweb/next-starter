// src/features/core/auditLog/services/server/pruning.ts

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { AuditLogTable } from "@/features/core/auditLog/entities/drizzle";

/**
 * 1 回の DELETE で扱う件数の既定値。
 * テーブルが大きく成長したケースで長時間ロックを避けるためのバッチサイズ。
 */
const DEFAULT_BATCH_SIZE = 1000;

/**
 * 反復回数の上限。1 回の cron 実行で削除しすぎないためのガード。
 * batch_size * max_iterations が 1 回の上限件数になる。
 */
const DEFAULT_MAX_ITERATIONS = 100;

export type PruneOptions = {
  /**
   * 1 反復あたりの削除件数。既定 1000。
   * 大きすぎると単一トランザクションの長時間ロックや WAL 圧迫を招くため、
   * I/O 帯域に応じて調整する。
   */
  batchSize?: number;
  /**
   * 反復回数の上限。既定 100（= 既定 batchSize と組み合わせて 1 回 10 万件まで）。
   * これを超えた分は次回の cron 実行に持ち越される。
   */
  maxIterations?: number;
};

export type PruneResult = {
  deletedCount: number;
  iterations: number;
  /** 上限到達で打ち切られた場合 true（次回の実行で残りを処理する想定） */
  truncated: boolean;
};

/**
 * 期限切れ監査ログを削除する。
 *
 * 各行の `retention_days` に基づき
 * `created_at + retention_days * INTERVAL '1 day' < NOW()`
 * を満たす行を削除する。
 *
 * - 大量データでの長時間ロックを避けるため `batchSize` ずつ反復削除する
 * - `FOR UPDATE SKIP LOCKED` で並走 cron / 書き込み tx と衝突しても進行する
 * - dead-letter テーブル (`audit_logs_failed`) は対象外。
 *   復旧失敗のまま長期保持されないよう、別途 `recoverDeadLetterAuditLogs` で扱う
 *
 * パーティショニング (PARTITION BY RANGE created_at) 導入後は、
 * 古いパーティション全体を DROP する方が効率的。本関数はその移行までの実装。
 */
export async function pruneExpiredAuditLogs(options: PruneOptions = {}): Promise<PruneResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  let deletedCount = 0;
  let iterations = 0;
  let lastBatchSize = batchSize;

  while (iterations < maxIterations && lastBatchSize === batchSize) {
    const result = (await db.execute(sql`
      WITH expired AS (
        SELECT id FROM ${AuditLogTable}
        WHERE ${AuditLogTable.createdAt} + (${AuditLogTable.retentionDays} * INTERVAL '1 day') < NOW()
        ORDER BY ${AuditLogTable.createdAt}
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM ${AuditLogTable}
      WHERE id IN (SELECT id FROM expired)
      RETURNING id
    `)) as Array<{ id: string }>;

    lastBatchSize = result.length;
    deletedCount += lastBatchSize;
    iterations += 1;

    // 削除対象が見つからなかった or バッチに満たなかった場合は次回まで待つ
    if (lastBatchSize === 0) break;
  }

  const truncated = iterations >= maxIterations && lastBatchSize === batchSize;

  return { deletedCount, iterations, truncated };
}
