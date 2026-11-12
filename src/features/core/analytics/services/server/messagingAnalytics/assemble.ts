// src/features/core/analytics/services/server/messagingAnalytics/assemble.ts
// 連絡の集計の組み立て(DB を読まない)。store の行を (期間, 軸の値) ごとに足し、指標・率・前の期間との変化率にする。
// - 開封・クリックは計測が閉なら null(0 と区別)
// - 配達の行ごとの指標(delivered〜clicked)は配達の行が保持の日数を過ぎた範囲なら null(detailRetained: false。日まとめは rollup が持つ)

import { changeRate } from "../utils/aggregation";
import type {
  DeliveryCountRow,
  DispatchCountRow,
  MessagingComparison,
  MessagingCounts,
  MessagingMetrics,
  MessagingRates,
  PeriodKey,
  ReadCountRow,
  UnsubscribeCountRow,
} from "./types";

const IN_APP = "inApp";
const NULL_KEY = "\u0000";

export function emptyCounts(): MessagingCounts {
  return {
    targeted: 0,
    sent: 0,
    failed: 0,
    skippedNoAddress: 0,
    suppressed: 0,
    skippedThrottled: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    opened: 0,
    clicked: 0,
    read: 0,
    inAppSent: 0,
    unsubscribed: 0,
  };
}

/** store の 4 つの行の組 */
export type SourceRows = {
  dispatch: readonly DispatchCountRow[];
  delivery: readonly DeliveryCountRow[];
  read: readonly ReadCountRow[];
  unsubscribe: readonly UnsubscribeCountRow[];
};

export type Bucket = { cur: MessagingCounts; prev: MessagingCounts };

/** 軸の値(null も 1 つの鍵)→ 期間ごとの数。byChannel = 経路の軸(行の channel を鍵にする、既読は inApp) */
export function bucketize(rows: SourceRows, options: { byChannel: boolean }): Map<string | null, Bucket> {
  const buckets = new Map<string, Bucket>();
  const get = (period: PeriodKey, group: string | null, channel: string) => {
    const key = (options.byChannel ? channel : group) ?? NULL_KEY;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { cur: emptyCounts(), prev: emptyCounts() };
      buckets.set(key, bucket);
    }
    return bucket[period];
  };
  for (const row of rows.dispatch) {
    const counts = get(row.period, row.group, row.channel);
    counts.targeted += row.targeted;
    counts.sent += row.sent;
    counts.failed += row.failed;
    counts.skippedNoAddress += row.skippedNoAddress;
    counts.suppressed += row.suppressed;
    counts.skippedThrottled += row.skippedThrottled;
    if (row.channel === IN_APP) counts.inAppSent += row.sent;
  }
  for (const row of rows.delivery) {
    const counts = get(row.period, row.group, row.channel);
    counts.delivered = (counts.delivered ?? 0) + row.delivered;
    counts.bounced = (counts.bounced ?? 0) + row.bounced;
    counts.complained = (counts.complained ?? 0) + row.complained;
    counts.opened = (counts.opened ?? 0) + row.opened;
    counts.clicked = (counts.clicked ?? 0) + row.clicked;
  }
  for (const row of rows.read) get(row.period, row.group, IN_APP).read += row.read;
  for (const row of rows.unsubscribe) get(row.period, row.group, row.channel).unsubscribed += row.count;
  return new Map([...buckets].map(([key, bucket]) => [key === NULL_KEY ? null : key, bucket]));
}

const ratio = (numerator: number | null, denominator: number): number | null =>
  numerator === null || denominator === 0 ? null : numerator / denominator;

export function ratesOf(counts: MessagingCounts): MessagingRates {
  return {
    deliveredRate: ratio(counts.delivered, counts.sent),
    bounceRate: ratio(counts.bounced, counts.sent),
    complaintRate: ratio(counts.complained, counts.sent),
    openRate: ratio(counts.opened, counts.sent),
    clickRate: ratio(counts.clicked, counts.sent),
    unsubscribeRate: ratio(counts.unsubscribed, counts.sent),
    failedRate: ratio(counts.failed, counts.targeted),
    suppressedRate: ratio(counts.suppressed, counts.targeted),
    readRate: ratio(counts.read, counts.inAppSent),
  };
}

/** 数を指標にする(測れない物を null に) */
export function toMetrics(
  counts: MessagingCounts,
  options: { trackingEnabled: boolean; detailRetained: boolean },
): MessagingMetrics {
  const result: MessagingCounts = { ...counts };
  if (!options.detailRetained) {
    result.delivered = null;
    result.bounced = null;
    result.complained = null;
    result.opened = null;
    result.clicked = null;
  }
  if (!options.trackingEnabled) {
    result.opened = null;
    result.clicked = null;
  }
  return { ...result, rates: ratesOf(result), detailRetained: options.detailRetained };
}

const COUNT_KEYS = Object.keys(emptyCounts()) as (keyof MessagingCounts)[];

export function compare(current: MessagingMetrics, previous: MessagingMetrics): MessagingComparison {
  const rates = Object.fromEntries(
    COUNT_KEYS.map((key) => {
      const now = current[key];
      const before = previous[key];
      return [key, now === null || before === null ? null : changeRate(now, before)];
    }),
  ) as Record<keyof MessagingCounts, number | null>;
  return { previous, changeRate: rates };
}
