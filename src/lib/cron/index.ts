// src/lib/cron/index.ts
// cron 基盤の公開エントリ(入口 ".")。task の探索(node:fs)は入口 "./node"(./node.ts)

export { verifyCronRequest } from "./auth";
export { createCronRoute, createCronTaskRoute } from "./createCronRoute";
export type { CreateCronRouteDeps, CreateCronRouteOptions, CronHandler, CronRouteGate, CronMaintenancePlug, CronRouteMaintenance, CronServerErrorInput } from "./createCronRoute";
export type { CronTaskDefinition, CronTaskOverride, CronTaskResult } from "./types";
export { isAtMostDailySchedule, isValidCronExpression, matchesCronExpression } from "./cronExpression";
export {
  CRON_PATH_PREFIX,
  CRON_PLANS,
  HOBBY_FALLBACK_SCHEDULE,
  STAGGER_MINUTES,
  buildVercelCrons,
  checkVercelCrons,
  cronTaskPath,
  findCronScheduleOverlaps,
  inferCronPlan,
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
export {
  EXPIRY_CHECKPOINT_PREFIX,
  EXPIRY_DEFAULT_BATCH,
  EXPIRY_LOCK_KEY,
  expiryCondition,
  expiryDeleteQuery,
  expiryItemName,
  expiryRuleProblems,
  runExpiryRules,
} from "./expiry";
export type { ExpiryCheckpoint, ExpiryItemResult, ExpiryRule, ExpiryRuleItem, ExpiryRuleKind, ExpiryRunResult, ExpiryStore } from "./expiry";
