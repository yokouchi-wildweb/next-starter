// src/config/app/interaction-tracking.config.ts

/**
 * インタラクション計測（interactionTracking）の設定
 */
export const INTERACTION_TRACKING_CONFIG = {
  /**
   * カウンタ行のシャード数。
   * 人気ターゲットへの同時クリックによる単一カウンタ行のロック競合を
   * 1/N に分散する。読み取りは shard を SUM するため値の意味は変わらない。
   * 注意: 減らしても既存 shard 行は残る（SUM が拾うため合計は正しいまま）
   */
  counterShardCount: 8,

  /**
   * イベント明細（interaction_events）の既定保持日数。
   * 集計カウンタ・日次集計は prune 対象外のため、合計値と時系列はこの期間を超えて保持される
   */
  defaultRetentionDays: 365,

  /**
   * 日次集計（interaction_daily_counters）の日界タイムゾーン。
   * 「どの時刻までを同じ1日と数えるか」の基準。analytics ドメインの既定と揃える
   */
  aggregationTimeZone: "Asia/Tokyo",
} as const;
