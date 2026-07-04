// src/config/app/user-counter.config.ts

/**
 * per-user カウンタ（userCounter）の設定
 */
export const USER_COUNTER_CONFIG = {
  /**
   * 日次カウンタ（user_daily_counters）の既定保持日数。
   * ユーザー日次はユーザー数 × 日数に比例して増えるため、
   * コンテンツ軸の日次集計（永久保持）と違い保持期限を設ける。
   * 累計カウンタ（user_counters）は prune 対象外のため、合計値は期限を超えて保持される
   */
  defaultRetentionDays: 730,

  /**
   * 日次カウンタの日界タイムゾーン。
   * 「どの時刻までを同じ1日と数えるか」の基準。interactionTracking / analytics と揃える
   */
  dailyTimeZone: "Asia/Tokyo",
} as const;
