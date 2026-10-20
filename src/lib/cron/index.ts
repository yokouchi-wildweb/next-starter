// src/lib/cron/index.ts
// cron 基盤の公開エントリ

export { verifyCronRequest } from "./auth";
export { createCronRoute, createCronTaskRoute } from "./createCronRoute";
export type { CronHandler, CreateCronRouteOptions } from "./createCronRoute";
export type { CronTaskDefinition, CronTaskResult } from "./types";
export { isAtMostDailySchedule, isValidCronExpression, matchesCronExpression } from "./cronExpression";
export {
  CRON_PATH_PREFIX,
  CRON_PLANS,
  HOBBY_FALLBACK_SCHEDULE,
  STAGGER_MINUTES,
  buildVercelCrons,
  checkVercelCrons,
  cronTaskPath,
  isCronPlan,
  listHobbyDowngradedTasks,
  validateCronSchedules,
} from "./vercelCrons";
export type { CronPlan, CronTaskScheduleSource, VercelCronEntry, VercelCronsCheckResult } from "./vercelCrons";
export { createDeadline, remainingBudgetMs, runBudgetedBatches } from "./runBudgetedBatches";
export type {
  BudgetedBatchPage,
  BudgetedBatchProgress,
  BudgetedBatchesStopReason,
  RunBudgetedBatchesOptions,
  RunBudgetedBatchesResult,
} from "./runBudgetedBatches";
