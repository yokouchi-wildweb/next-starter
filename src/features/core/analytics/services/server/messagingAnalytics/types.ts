// src/features/core/analytics/services/server/messagingAnalytics/types.ts
// 連絡(messaging)の集計の型。指標・軸・各ビューの返値と、SQL の部分(store)が返す行。

import type { DateRangeParams, Granularity } from "@/features/core/analytics/types/common";

/** 内訳の軸 */
export const MESSAGING_BREAKDOWN_AXES = ["channel", "message", "category", "template", "tag"] as const;
export type MessagingBreakdownAxis = (typeof MESSAGING_BREAKDOWN_AXES)[number];

/** 集計の絞り(どれも省略 = 全部) */
export type MessagingAnalyticsFilter = {
  channel?: string;
  messageKey?: string;
  category?: string;
};

export type MessagingAnalyticsParams = DateRangeParams & MessagingAnalyticsFilter;

/**
 * 指標の数。null = 測れない(開封・クリック: 計測 messagingTracking が閉 / 配達の行ごとの指標: 配達の行が保持の日数を過ぎた)
 * - targeted / sent / failed / skippedNoAddress / suppressed / skippedThrottled: 回の channel_counts(全員宛ての行の無い数・共有のお知らせも入る)
 * - delivered / bounced / complained / opened / clicked: 配達の行
 * - read: お知らせの既読(inApp)。inAppSent = その分母
 * - unsubscribed: 配信停止の行(止めた時刻で数える)
 */
export type MessagingCounts = {
  targeted: number;
  sent: number;
  failed: number;
  skippedNoAddress: number;
  /** 止めで飛ばした(好み・宛先の停止) */
  suppressed: number;
  skippedThrottled: number;
  delivered: number | null;
  bounced: number | null;
  complained: number | null;
  opened: number | null;
  clicked: number | null;
  read: number;
  inAppSent: number;
  unsubscribed: number;
};

/** 同じ送りの組の率(分母 0・分子 null は null) */
export type MessagingRates = {
  /** ÷ sent */
  deliveredRate: number | null;
  bounceRate: number | null;
  complaintRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  unsubscribeRate: number | null;
  /** ÷ targeted */
  failedRate: number | null;
  suppressedRate: number | null;
  /** ÷ inAppSent */
  readRate: number | null;
};

/** 指標の 1 組 */
export type MessagingMetrics = MessagingCounts & {
  rates: MessagingRates;
  /** 配達の行がまだ残っているか(false = delivered〜clicked は null) */
  detailRetained: boolean;
};

/** 前の期間との比較 */
export type MessagingComparison = {
  previous: MessagingMetrics;
  /** 数の変化率(null = 前が 0 で今が 0 でない・どちらかが null) */
  changeRate: Record<keyof MessagingCounts, number | null>;
};

export type MessagingRangeResponse = { dateFrom: string; dateTo: string; granularity: Granularity };

export type MessagingSummaryResponse = MessagingRangeResponse & {
  metrics: MessagingMetrics;
  comparison: MessagingComparison;
  /** 開封・クリックの計測が開か */
  trackingEnabled: boolean;
};

export type MessagingSeriesResponse = MessagingRangeResponse & {
  history: ({ date: string } & MessagingMetrics)[];
  trackingEnabled: boolean;
};

export type MessagingBreakdownEntry = {
  /** 軸の値(null = 無し: テンプレートで無い・タグが無い・配信停止の結び付きが無い) */
  key: string | null;
  /** 見出し(テンプレートの名前など。無ければ key) */
  label: string | null;
  metrics: MessagingMetrics;
  comparison: MessagingComparison;
};

export type MessagingBreakdownResponse = MessagingRangeResponse & {
  axis: MessagingBreakdownAxis;
  entries: MessagingBreakdownEntry[];
  trackingEnabled: boolean;
};

export type MessagingDispatchRow = {
  dispatchId: string;
  messageKey: string | null;
  category: string | null;
  kind: string | null;
  templateId: string | null;
  tags: string[];
  /** 送った時刻(予約なら予約の時刻)ISO */
  sentAt: string;
  status: string;
  retracted: boolean;
  metrics: MessagingMetrics;
};

export type MessagingDispatchesResponse = MessagingRangeResponse & {
  items: MessagingDispatchRow[];
  nextCursor: string | null;
  /** 回の管理(messagingDispatches)が閉なら false で items は空 */
  dispatchesEnabled: boolean;
  trackingEnabled: boolean;
};

// ============================================================================
// SQL の部分(store)が返す行。period = "cur" | "prev"、group = 軸の値(軸なしは null)
// ============================================================================

export type PeriodKey = "cur" | "prev";

export type DispatchCountRow = {
  period: PeriodKey;
  group: string | null;
  channel: string;
  targeted: number;
  sent: number;
  failed: number;
  skippedNoAddress: number;
  suppressed: number;
  skippedThrottled: number;
};

export type DeliveryCountRow = {
  period: PeriodKey;
  group: string | null;
  channel: string;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
};

export type ReadCountRow = { period: PeriodKey; group: string | null; read: number };

export type UnsubscribeCountRow = { period: PeriodKey; group: string | null; channel: string; count: number };

/** 集計の範囲と分け方 */
export type MessagingQueryScope = {
  current: { from: Date; to: Date };
  /** 前の期間(無い = 当期だけ) */
  previous?: { from: Date; to: Date };
  /** 分け方: none = 期間だけ、date = 粒度のバケット、軸、dispatch = 回、rollup = 日まとめの dims */
  /** rollup = 日まとめの dims(group = JSON [message_key, category]、経路は行の channel) */
  groupBy: "none" | "date" | MessagingBreakdownAxis | "dispatch" | "rollup";
  granularity: Granularity;
  timezone: string;
  filter: MessagingAnalyticsFilter;
  /** groupBy dispatch の時の回 */
  dispatchIds?: readonly string[];
};

/** 回ごとのビューの回の行 */
export type DispatchPageRow = {
  id: string;
  messageKey: string | null;
  category: string | null;
  kind: string | null;
  templateId: string | null;
  tags: string[] | null;
  anchor: Date;
  status: string;
  retractedAt: Date | null;
};

/** 集計の SQL の部分(テストは偽物を渡す) */
export type MessagingAnalyticsStore = {
  dispatchCounts: (scope: MessagingQueryScope) => Promise<DispatchCountRow[]>;
  deliveryCounts: (scope: MessagingQueryScope) => Promise<DeliveryCountRow[]>;
  readCounts: (scope: MessagingQueryScope) => Promise<ReadCountRow[]>;
  unsubscribeCounts: (scope: MessagingQueryScope) => Promise<UnsubscribeCountRow[]>;
  /** 回の頁(送った時刻の新しい順、keyset) */
  dispatchPage: (params: {
    from: Date;
    to: Date;
    filter: MessagingAnalyticsFilter;
    cursor: { anchor: Date; id: string } | null;
    limit: number;
  }) => Promise<DispatchPageRow[]>;
  /** テンプレートの名前(内訳 template の見出し) */
  templateNames: (ids: readonly string[]) => Promise<Map<string, string>>;
};
