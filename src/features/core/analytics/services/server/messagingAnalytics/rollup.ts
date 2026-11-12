// src/features/core/analytics/services/server/messagingAnalytics/rollup.ts
// 連絡の日まとめ(rollup)のメトリクス。1 指標 = 1 つの鍵 messaging.<measure>(flow)、dims {channel, messageKey, category}。
// - 数え方は集計の口(service.ts)と同じ store・同じ送りの組(回を送った日の cohort、配信停止は止めた日)
// - 1 日分の読み込み(4 つの問い合わせ)は同じ日を計算する指標で共有する(短い memo)
// - enabled は受け口の項目が値に書く(常時実行の入口の検査が項目の値を見る): 集計の口と同じ門 messagingAnalytics、
//   開封・クリックは計測 messagingTracking も
// - lookbackDays: 回の数・配信停止 = cron の既定、到達・bounce・苦情 7、開封・クリック 14、既読 30(送った日に遅れて足される)
// skipped_no_address / skipped_throttled は日まとめにしない(集計の口だけ)

import type { RollupDayContext, RollupMetricConfig, RollupMetricValue } from "../rollup/types";
import type { SourceRows } from "./assemble";
import type { MessagingAnalyticsStore, MessagingQueryScope } from "./types";

/** 日まとめにする指標(D37) */
export const MESSAGING_ROLLUP_MEASURES = [
  "targeted",
  "sent",
  "failed",
  "suppressed",
  "delivered",
  "bounced",
  "complained",
  "opened",
  "clicked",
  "read",
  "unsubscribed",
] as const;
export type MessagingRollupMeasure = (typeof MESSAGING_ROLLUP_MEASURES)[number];

const LOOKBACK: Partial<Record<MessagingRollupMeasure, number>> = {
  delivered: 7,
  bounced: 7,
  complained: 7,
  opened: 14,
  clicked: 14,
  read: 30,
};

const MEMO_MS = 5 * 60 * 1000;

export type MessagingRollupDeps = {
  store: MessagingAnalyticsStore;
  now: () => number;
};

type Dims = { channel: string; messageKey: string | null; category: string | null };

/** group = JSON [message_key, category](store の rollup の分け方) */
function dimsOf(channel: string, group: string | null): Dims {
  let messageKey: string | null = null;
  let category: string | null = null;
  try {
    const parsed = group ? (JSON.parse(group) as unknown) : null;
    if (Array.isArray(parsed)) {
      messageKey = typeof parsed[0] === "string" ? parsed[0] : null;
      category = typeof parsed[1] === "string" ? parsed[1] : null;
    }
  } catch {
    // 形の違う値は dims なし(null)に寄せる
  }
  return { channel, messageKey, category };
}

/** 1 日分の行から 1 指標の値(dims ごとに足す) */
export function measureValues(rows: SourceRows, measure: MessagingRollupMeasure): RollupMetricValue[] {
  const totals = new Map<string, { dims: Dims; value: number }>();
  const add = (channel: string, group: string | null, value: number) => {
    if (value === 0) return;
    const dims = dimsOf(channel, group);
    const key = JSON.stringify([dims.channel, dims.messageKey, dims.category]);
    const entry = totals.get(key) ?? { dims, value: 0 };
    entry.value += value;
    totals.set(key, entry);
  };
  switch (measure) {
    case "targeted":
    case "sent":
    case "failed":
    case "suppressed":
      for (const row of rows.dispatch) add(row.channel, row.group, row[measure]);
      break;
    case "delivered":
    case "bounced":
    case "complained":
    case "opened":
    case "clicked":
      for (const row of rows.delivery) add(row.channel, row.group, row[measure]);
      break;
    case "read":
      for (const row of rows.read) add("inApp", row.group, row.read);
      break;
    case "unsubscribed":
      for (const row of rows.unsubscribe) add(row.channel, row.group, row.count);
      break;
  }
  return [...totals.values()].map(({ dims, value }) => ({ value, dims }));
}

export function createMessagingRollupFactory(deps: MessagingRollupDeps) {
  const memo = new Map<string, { at: number; rows: Promise<SourceRows> }>();

  function loadDay(day: RollupDayContext): Promise<SourceRows> {
    const key = `${day.dateFrom.toISOString()}|${day.dateTo.toISOString()}`;
    const now = deps.now();
    for (const [entryKey, entry] of memo) if (now - entry.at > MEMO_MS) memo.delete(entryKey);
    const hit = memo.get(key);
    if (hit) return hit.rows;
    const scope: MessagingQueryScope = {
      current: { from: day.dateFrom, to: day.dateTo },
      groupBy: "rollup",
      granularity: "day",
      timezone: day.timezone,
      filter: {},
    };
    const rows = Promise.all([
      deps.store.dispatchCounts(scope),
      deps.store.deliveryCounts(scope),
      deps.store.readCounts(scope),
      deps.store.unsubscribeCounts(scope),
    ]).then(([dispatch, delivery, read, unsubscribe]) => ({ dispatch, delivery, read, unsubscribe }));
    // 失敗は memo に残さない(次の呼び出しで読み直す)
    rows.catch(() => memo.delete(key));
    memo.set(key, { at: now, rows });
    return rows;
  }

  /** 1 指標のメトリクス(enabled = 項目が渡す門) */
  return function messagingRollupMetric(
    measure: MessagingRollupMeasure,
    options: { enabled: () => boolean },
  ): RollupMetricConfig {
    return {
      key: `messaging.${measure}`,
      kind: "flow",
      ...(LOOKBACK[measure] ? { lookbackDays: LOOKBACK[measure] } : {}),
      enabled: options.enabled,
      compute: async (day) => measureValues(await loadDay(day), measure),
    };
  };
}
