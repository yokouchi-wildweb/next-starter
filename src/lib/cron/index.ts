// src/lib/cron/index.ts
// cron 基盤の公開エントリ

export { verifyCronRequest } from "./auth";
export { createCronRoute, createCronTaskRoute } from "./createCronRoute";
export type { CronHandler, CreateCronRouteOptions } from "./createCronRoute";
export { CRON_CADENCES } from "./types";
export type { CronCadence, CronTaskDefinition, CronTaskResult } from "./types";
export {
  CRON_PATH_PREFIX,
  CRON_PLANS,
  STAGGER_MINUTES,
  buildVercelCrons,
  checkVercelCrons,
  cronTaskPath,
  isAtMostDailySchedule,
  isCronPlan,
} from "./vercelCrons";
export type {
  CronPlan,
  CronScheduleConfig,
  CronTaskScheduleSource,
  VercelCronEntry,
  VercelCronsCheckResult,
} from "./vercelCrons";
export { createDeadline, remainingBudgetMs, runBudgetedBatches } from "./runBudgetedBatches";
export type {
  BudgetedBatchPage,
  BudgetedBatchProgress,
  BudgetedBatchesStopReason,
  RunBudgetedBatchesOptions,
  RunBudgetedBatchesResult,
} from "./runBudgetedBatches";
