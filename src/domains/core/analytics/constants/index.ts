// src/domains/core/analytics/constants/index.ts

import type { Granularity } from "../types/common";

/** デフォルトタイムゾーン（IANA TZ名） */
export const DEFAULT_TIMEZONE = "Asia/Tokyo";

/** デフォルトの集計日数 */
export const DEFAULT_ANALYTICS_DAYS = 30;

/** 最大取得可能日数（day粒度の上限。他粒度は MAX_GRANULARITY_PERIOD_DAYS を参照） */
export const MAX_ANALYTICS_DAYS = 365;

/** デフォルト集計粒度（省略時の後方互換用） */
export const DEFAULT_GRANULARITY: Granularity = "day";

/**
 * 各粒度ごとの最大取得期間（日数換算）。
 *
 * バケット数が膨張するのを防ぐため granularity ごとに上限を設ける。
 * 例: hour で 31 日 → 744 ポイント、month で 10 年 → 120 ポイント。
 */
export const MAX_GRANULARITY_PERIOD_DAYS: Record<Granularity, number> = {
  hour: 31,
  day: MAX_ANALYTICS_DAYS,
  week: 365 * 2,
  month: 365 * 10,
};

/** ウォレットランキングのデフォルト件数 */
export const DEFAULT_RANKING_LIMIT = 50;

/** ウォレットランキングの最大取得件数 */
export const MAX_RANKING_LIMIT = 200;

/** 購入ランキングのデフォルト件数 */
export const DEFAULT_PURCHASE_RANKING_LIMIT = 20;

/** 購入ランキングの最大取得件数 */
export const MAX_PURCHASE_RANKING_LIMIT = 100;

/** 分布APIの最大境界値数 */
export const MAX_DISTRIBUTION_BOUNDARIES = 20;

// ============================================================================
// サーバーサイド集計キャッシュ（withAnalyticsCache、共有の置き場 "use cache: remote"）
// ============================================================================

/** 当日を含む範囲の寿命（秒）。鮮度優先で短め */
export const DEFAULT_ANALYTICS_CACHE_LIVE_SECONDS = 60;

/**
 * 確定済み範囲（過去日のみ）の寿命（秒）。
 *
 * immutable にはしない: バックフィル・ロールアップ再計算・集計除外の遡及適用で
 * 過去バケットの値も書き換わり得るため、長期だが有限の寿命 + 札で消す（invalidateAnalyticsCache）。
 */
export const DEFAULT_ANALYTICS_CACHE_CLOSED_SECONDS = 12 * 60 * 60;

/**
 * 読みごとに変える寿命の上限（秒）。ドメインの宣言 cache の上限と同じ
 * （確定済み = 札で消す tagged の 30 日、当日 = 書き込みを追わない ttl の 1 時間。scripts/structure/domain/spec/cache.mjs）
 */
export const MAX_ANALYTICS_CACHE_CLOSED_SECONDS = 30 * 24 * 60 * 60;
export const MAX_ANALYTICS_CACHE_LIVE_SECONDS = 60 * 60;
