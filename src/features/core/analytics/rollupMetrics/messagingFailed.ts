// src/features/core/analytics/rollupMetrics/messagingFailed.ts
// 連絡の日まとめ messaging.failed(dims channel / messageKey / category)。中身: services/server/messagingAnalytics/rollup.ts

import { gate } from "@/featureGate";
import { messagingRollupMetric } from "@/features/core/analytics/services/server/messagingAnalytics/rollupMetric";

export const metric = messagingRollupMetric("failed", {
  // 集計の口と同じ門
  enabled: () => gate.enabled("messagingAnalytics"),
});
