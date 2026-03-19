// src/features/core/batchJob/constants/index.ts

export const BATCH_JOB_CONFIG = {
  /** executeAllのデフォルト最大実行時間(ms) — Vercel関数タイムアウト(60s)より少し短い */
  defaultMaxDurationMs: 55_000,
  /** 1チャンクあたりのデフォルトアイテム数 */
  defaultBatchSize: 100,
  /** processItemモードのprocessing→pendingリカバリタイムアウト(ms) */
  defaultRecoveryTimeoutMs: 300_000,
  /** デフォルト最大リトライ回数 */
  defaultMaxRetryCount: 2,
  /** ジョブ作成時のアイテム一括INSERT単位 */
  itemsInsertChunkSize: 5_000,
} as const;
