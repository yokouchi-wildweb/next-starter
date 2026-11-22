// 生成物・編集不可: pnpm generate extensions が src/domains/core/analytics/extensionPoints.ts から生成する
// rollupMetrics: src/domains/core/analytics/rollupMetrics/<名前>.ts(x) か <名前>/index.ts(x) の export const metric(並びはファイル名の順)

import type { RollupMetricConfig } from "@/domains/core/analytics/services/server/rollup/types";

import { metric as rollupMetrics_messagingBounced } from "@/domains/core/analytics/rollupMetrics/messagingBounced";
import { metric as rollupMetrics_messagingClicked } from "@/domains/core/analytics/rollupMetrics/messagingClicked";
import { metric as rollupMetrics_messagingComplained } from "@/domains/core/analytics/rollupMetrics/messagingComplained";
import { metric as rollupMetrics_messagingDelivered } from "@/domains/core/analytics/rollupMetrics/messagingDelivered";
import { metric as rollupMetrics_messagingFailed } from "@/domains/core/analytics/rollupMetrics/messagingFailed";
import { metric as rollupMetrics_messagingOpened } from "@/domains/core/analytics/rollupMetrics/messagingOpened";
import { metric as rollupMetrics_messagingRead } from "@/domains/core/analytics/rollupMetrics/messagingRead";
import { metric as rollupMetrics_messagingSent } from "@/domains/core/analytics/rollupMetrics/messagingSent";
import { metric as rollupMetrics_messagingSuppressed } from "@/domains/core/analytics/rollupMetrics/messagingSuppressed";
import { metric as rollupMetrics_messagingTargeted } from "@/domains/core/analytics/rollupMetrics/messagingTargeted";
import { metric as rollupMetrics_messagingUnsubscribed } from "@/domains/core/analytics/rollupMetrics/messagingUnsubscribed";

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
