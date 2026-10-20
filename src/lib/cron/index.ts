// src/lib/cron/index.ts
// cron 基盤の公開エントリ

export { verifyCronRequest } from "./auth";
export { createCronRoute, createCronTaskRoute } from "./createCronRoute";
export type { CronHandler, CreateCronRouteOptions } from "./createCronRoute";
export {
  createCronDispatchRoute,
  isCronDispatchCadence,
  selectCronDispatchTargets,
} from "./createCronDispatchRoute";
export type { CreateCronDispatchRouteOptions, CronDispatchTaskOutcome } from "./createCronDispatchRoute";
export { CRON_CADENCES } from "./types";
export type { CronCadence, CronDispatchCadence, CronTaskDefinition, CronTaskResult } from "./types";
export {
  CRON_DISPATCH_CADENCES_BY_PLAN,
  CRON_DISPATCH_PATH_PREFIX,
  CRON_PLANS,
  buildVercelCrons,
  checkVercelCrons,
  cronDispatchPath,
  isAtMostDailySchedule,
  isCronPlan,
} from "./vercelCrons";
export type { CronPlan, CronScheduleConfig, VercelCronEntry, VercelCronsCheckResult } from "./vercelCrons";
export { createDeadline, remainingBudgetMs, runBudgetedBatches } from "./runBudgetedBatches";
export type {
  BudgetedBatchPage,
  BudgetedBatchProgress,
  BudgetedBatchesStopReason,
  RunBudgetedBatchesOptions,
  RunBudgetedBatchesResult,
} from "./runBudgetedBatches";
