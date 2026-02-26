// src/features/core/analytics/types/common.ts
// 集計共通型定義

// ============================================================================
// 日付範囲
// ============================================================================

/** 日付範囲パラメータ（APIリクエスト共通） */
export type DateRangeParams = {
  /** 日数指定（dateFrom/dateToより低優先） */
  days?: number;
  /** 開始日（ISO文字列 or YYYY-MM-DD） */
  dateFrom?: string;
  /** 終了日（ISO文字列 or YYYY-MM-DD） */
  dateTo?: string;
};

/** 解決済みの日付範囲 */
export type ResolvedDateRange = {
  dateFrom: Date;
  dateTo: Date;
  dayCount: number;
};

// ============================================================================
// 日別集計
// ============================================================================

/** 日別レコードの基底型 */
export type DailyRecord<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** YYYY-MM-DD */
  date: string;
} & T;

/** 内訳エントリの基底型 */
export type BreakdownEntry = {
  amount: number;
  count: number;
  uniqueUsers: number;
};

/** 日別集計レスポンスの基底型 */
export type DailyAnalyticsResponse<T extends Record<string, unknown>> = {
  dateFrom: string;
  dateTo: string;
  history: DailyRecord<T>[];
};

// ============================================================================
// 期間サマリー
// ============================================================================

/** 期間サマリーレスポンスの基底型 */
export type PeriodSummaryResponse<T extends Record<string, unknown>> = {
  dateFrom: string;
  dateTo: string;
} & T;

/** 前期比較データ */
export type PeriodComparison<T extends Record<string, unknown>> = {
  previous: T;
  changeRate: Partial<Record<keyof T, number>>;
};

// ============================================================================
// ランキング
// ============================================================================

/** ランキングレスポンスの基底型 */
export type RankingResponse<T extends Record<string, unknown>> = {
  items: RankingEntry<T>[];
  total: number;
};

/** ランキングエントリの基底型 */
export type RankingEntry<T extends Record<string, unknown>> = {
  rank: number;
} & T;

// ============================================================================
// フィルタ
// ============================================================================

/** ウォレット種別フィルタ（集計API共通） */
export type WalletTypeFilter = {
  walletType?: string;
};

/** ページネーション */
export type PaginationParams = {
  limit?: number;
  page?: number;
};
