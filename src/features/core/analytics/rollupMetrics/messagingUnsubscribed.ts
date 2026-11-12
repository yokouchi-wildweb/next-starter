// src/features/core/analytics/rollupMetrics/messagingUnsubscribed.ts
// 連絡の日まとめ messaging.unsubscribed(dims channel / messageKey / category)。中身: services/server/messagingAnalytics/rollup.ts

import { gate } from "@/featureGate";
import { messagingRollupMetric } from "@/features/core/analytics/services/server/messagingAnalytics/rollupMetric";

export const metric = messagingRollupMetric("unsubscribed", {
  // 集計の口と同じ門
  enabled: () => gate.enabled("messagingAnalytics"),
});
