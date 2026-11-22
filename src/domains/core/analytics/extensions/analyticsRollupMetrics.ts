// 生成物・編集不可: pnpm generate extensions が src/domains/core/analytics/extensionPoints.ts から生成する
// analyticsRollupMetrics: 差す側の <ドメイン>/plugs/analyticsRollupMetrics/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const metric(並びは<差す側>/<名前> の順、常に読む: gate.plugs を掛けず項目の enabled で閉じる)

import type { RollupMetricConfig } from "@/domains/core/analytics/services/server/rollup/types";

import { metric as analyticsRollupMetrics_messaging_messagingBounced } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingBounced";
import { metric as analyticsRollupMetrics_messaging_messagingClicked } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingClicked";
import { metric as analyticsRollupMetrics_messaging_messagingComplained } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingComplained";
import { metric as analyticsRollupMetrics_messaging_messagingDelivered } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingDelivered";
import { metric as analyticsRollupMetrics_messaging_messagingFailed } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingFailed";
import { metric as analyticsRollupMetrics_messaging_messagingOpened } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingOpened";
import { metric as analyticsRollupMetrics_messaging_messagingRead } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingRead";
import { metric as analyticsRollupMetrics_messaging_messagingSent } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingSent";
import { metric as analyticsRollupMetrics_messaging_messagingSuppressed } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingSuppressed";
import { metric as analyticsRollupMetrics_messaging_messagingTargeted } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingTargeted";
import { metric as analyticsRollupMetrics_messaging_messagingUnsubscribed } from "@/domains/core/messaging/plugs/analyticsRollupMetrics/messagingUnsubscribed";

export const analyticsRollupMetrics: { domain: string | null; name: string; requires: readonly string[]; plug: RollupMetricConfig }[] = [
  { domain: "messaging", name: "messagingBounced", requires: [], plug: analyticsRollupMetrics_messaging_messagingBounced },
  { domain: "messaging", name: "messagingClicked", requires: [], plug: analyticsRollupMetrics_messaging_messagingClicked },
  { domain: "messaging", name: "messagingComplained", requires: [], plug: analyticsRollupMetrics_messaging_messagingComplained },
  { domain: "messaging", name: "messagingDelivered", requires: [], plug: analyticsRollupMetrics_messaging_messagingDelivered },
  { domain: "messaging", name: "messagingFailed", requires: [], plug: analyticsRollupMetrics_messaging_messagingFailed },
  { domain: "messaging", name: "messagingOpened", requires: [], plug: analyticsRollupMetrics_messaging_messagingOpened },
  { domain: "messaging", name: "messagingRead", requires: [], plug: analyticsRollupMetrics_messaging_messagingRead },
  { domain: "messaging", name: "messagingSent", requires: [], plug: analyticsRollupMetrics_messaging_messagingSent },
  { domain: "messaging", name: "messagingSuppressed", requires: [], plug: analyticsRollupMetrics_messaging_messagingSuppressed },
  { domain: "messaging", name: "messagingTargeted", requires: [], plug: analyticsRollupMetrics_messaging_messagingTargeted },
  { domain: "messaging", name: "messagingUnsubscribed", requires: [], plug: analyticsRollupMetrics_messaging_messagingUnsubscribed },
];
