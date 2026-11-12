// src/features/core/analytics/services/server/messagingAnalytics/rollupMetric.ts
// 連絡の日まとめのメトリクスの本物の部品(SQL の store)。受け口の項目 rollupMetrics/messaging<Measure>.ts が 1 行で使う

import { createMessagingRollupFactory } from "./rollup";
import { drizzleMessagingAnalyticsStore } from "./store";

export const messagingRollupMetric = createMessagingRollupFactory({
  store: drizzleMessagingAnalyticsStore,
  now: () => Date.now(),
});
