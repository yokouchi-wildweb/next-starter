// 生成物・編集不可: pnpm generate extensions が src/features/core/analytics/extensionPoints.ts から生成する
// rollupMetrics: src/features/core/analytics/rollupMetrics/<名前>.ts(x) か <名前>/index.ts(x) の export const metric(並びはファイル名の順)

import type { RollupMetricConfig } from "@/features/core/analytics/services/server/rollup/types";

import { metric as rollupMetrics_messagingBounced } from "@/features/core/analytics/rollupMetrics/messagingBounced";
import { metric as rollupMetrics_messagingClicked } from "@/features/core/analytics/rollupMetrics/messagingClicked";
import { metric as rollupMetrics_messagingComplained } from "@/features/core/analytics/rollupMetrics/messagingComplained";
import { metric as rollupMetrics_messagingDelivered } from "@/features/core/analytics/rollupMetrics/messagingDelivered";
import { metric as rollupMetrics_messagingFailed } from "@/features/core/analytics/rollupMetrics/messagingFailed";
import { metric as rollupMetrics_messagingOpened } from "@/features/core/analytics/rollupMetrics/messagingOpened";
import { metric as rollupMetrics_messagingRead } from "@/features/core/analytics/rollupMetrics/messagingRead";
import { metric as rollupMetrics_messagingSent } from "@/features/core/analytics/rollupMetrics/messagingSent";
import { metric as rollupMetrics_messagingSuppressed } from "@/features/core/analytics/rollupMetrics/messagingSuppressed";
import { metric as rollupMetrics_messagingTargeted } from "@/features/core/analytics/rollupMetrics/messagingTargeted";
import { metric as rollupMetrics_messagingUnsubscribed } from "@/features/core/analytics/rollupMetrics/messagingUnsubscribed";

export const rollupMetrics: RollupMetricConfig[] = [
  rollupMetrics_messagingBounced,
  rollupMetrics_messagingClicked,
  rollupMetrics_messagingComplained,
  rollupMetrics_messagingDelivered,
  rollupMetrics_messagingFailed,
  rollupMetrics_messagingOpened,
  rollupMetrics_messagingRead,
  rollupMetrics_messagingSent,
  rollupMetrics_messagingSuppressed,
  rollupMetrics_messagingTargeted,
  rollupMetrics_messagingUnsubscribed,
];
