// src/features/core/interactionTracking/services/server/index.ts

export { interactionService } from "./interactionService";
export { record, type RecordInteractionInput } from "./wrappers/record";
export { recordBatch, type RecordBatchEntry } from "./wrappers/recordBatch";
export { getCounts, getCountsBulk } from "./wrappers/getCounts";
export { getDailySeries, type GetDailySeriesOptions } from "./wrappers/getDailySeries";
export {
  getAudience,
  getAudienceSummary,
  AUDIENCE_ORDER_BY,
  type AudienceOrderBy,
  type GetAudienceOptions,
} from "./wrappers/getAudience";
export {
  pruneExpiredInteractionEvents,
  type PruneOptions,
  type PruneResult,
} from "./pruning";
