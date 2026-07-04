// src/features/core/wallet/services/server/lots/pruneConsumedLots.ts
// 消費し尽くしたロット（remaining = 0）の定期削除
//
// remaining = 0 のロットは会計上の役割を終えた行であり、残高との不変条件にも
// 失効スイープにも関与しない（部分インデックスは remaining > 0 の行しか含まない）。
// 履歴・監査は wallet_histories / audit_logs が持つため、保持期間経過後は安全に物理削除できる。
//
// 付与のたびに行が増えるため、付与頻度が高いプロジェクトではこの prune を
// 日次で回さないと wallet_lots が単調増加する。
//
// wallet-expiration.config.ts の有効/無効に関わらず動作する
// （機能を無効化した後に残った死んだロットも掃除できるようにするため）。

import { sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { WalletLotTable } from "@/features/core/wallet/entities/drizzle";
import { WALLET_LOT_PRUNE_RETENTION_DAYS } from "@/config/app/wallet-expiration.config";

/** 1 反復あたりの削除件数。既存の audit_logs 等のプルーニングと同値で揃える */
const DEFAULT_BATCH_SIZE = 1000;

/** 反復回数の上限。1 回の cron 実行で削除しすぎないためのガード */
const DEFAULT_MAX_ITERATIONS = 100;

export type PruneConsumedLotsOptions = {
  batchSize?: number;
  maxIterations?: number;
  /** remaining = 0 になってからではなく作成からの経過日数で判定（既定: config 値） */
  retentionDays?: number;
};

export type PruneConsumedLotsResult = {
  deletedCount: number;
  iterations: number;
  /** 上限到達で打ち切られた場合 true（次回 cron で残りを処理） */
  truncated: boolean;
};

/**
 * 消費し尽くしたロットを削除する。
 *
 * 判定: remaining = 0 かつ created_at が retentionDays より古い行。
 * ロットの生存期間は expirationDays で上限が切られるため、created_at 基準で十分
 * （consumed_at のような追加カラムを持たずに済ませる意図）。
 *
 * audit_logs と同じパターン:
 * - batchSize ずつ反復削除して長時間ロックを回避
 * - FOR UPDATE SKIP LOCKED で並走トランザクションと衝突しても進行
 */
export async function pruneConsumedWalletLots(
  options: PruneConsumedLotsOptions = {},
): Promise<PruneConsumedLotsResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const retentionDays = options.retentionDays ?? WALLET_LOT_PRUNE_RETENTION_DAYS;

  let deletedCount = 0;
  let iterations = 0;
  let lastBatchSize = batchSize;

  while (iterations < maxIterations && lastBatchSize === batchSize) {
    const result = (await db.execute(sql`
      WITH consumed AS (
        SELECT id FROM ${WalletLotTable}
        WHERE ${WalletLotTable.remaining} = 0
          AND ${WalletLotTable.createdAt} < NOW() - make_interval(days => ${retentionDays})
        ORDER BY ${WalletLotTable.createdAt}
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM ${WalletLotTable}
      WHERE id IN (SELECT id FROM consumed)
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
