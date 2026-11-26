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
  EXPIRY_FAILED_LIST_MAX,
  EXPIRY_LOCK_KEY,
  EXPIRY_REMOVE_DEFAULT_BATCH,
  EXPIRY_REMOVE_MAX_BATCH,
  expiryBatchSize,
  expiryCondition,
  expiryDeleteQuery,
  expiryItemName,
  expiryRuleProblems,
  expirySelectKeysQuery,
  runExpiryRules,
} from "./expiry";
export type {
  ExpiryCheckpoint,
  ExpiryItemResult,
  ExpiryRemove,
  ExpiryRemoveContext,
  ExpiryRemoveResult,
  ExpiryRule,
  ExpiryRuleItem,
  ExpiryRuleKind,
  ExpiryRunResult,
  ExpiryStore,
} from "./expiry";
