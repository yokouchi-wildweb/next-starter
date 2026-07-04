// src/features/core/interactionTracking/services/server/index.ts

export { interactionService } from "./interactionService";
export { record, type RecordInteractionInput } from "./wrappers/record";
export { getCounts, getCountsBulk } from "./wrappers/getCounts";
export { getDailySeries, type GetDailySeriesOptions } from "./wrappers/getDailySeries";
export {
  pruneExpiredInteractionEvents,
  type PruneOptions,
  type PruneResult,
} from "./pruning";
