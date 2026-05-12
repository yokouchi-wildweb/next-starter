// src/features/core/analytics/constants/index.ts

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
