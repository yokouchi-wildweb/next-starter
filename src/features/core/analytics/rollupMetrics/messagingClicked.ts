// src/features/core/analytics/rollupMetrics/messagingClicked.ts
// 連絡の日まとめ messaging.clicked(dims channel / messageKey / category)。中身: services/server/messagingAnalytics/rollup.ts

import { gate } from "@/featureGate";
import { messagingRollupMetric } from "@/features/core/analytics/services/server/messagingAnalytics/rollupMetric";

export const metric = messagingRollupMetric("clicked", {
  // 集計の口と同じ門(開封・クリックは計測も開の時だけ)
  enabled: () => gate.enabled("messagingAnalytics") && gate.enabled("messagingTracking"),
});
