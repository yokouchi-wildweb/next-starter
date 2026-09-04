// src/lib/cron/index.ts
// cron 基盤の公開エントリ

export { verifyCronRequest } from "./auth";
export { createCronRoute } from "./createCronRoute";
export type { CronHandler, CreateCronRouteOptions } from "./createCronRoute";
export { createDeadline, remainingBudgetMs, runBudgetedBatches } from "./runBudgetedBatches";
export type {
  BudgetedBatchPage,
  BudgetedBatchProgress,
  BudgetedBatchesStopReason,
  RunBudgetedBatchesOptions,
  RunBudgetedBatchesResult,
} from "./runBudgetedBatches";
