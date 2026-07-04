// src/features/core/analytics/types/common.ts
// 集計共通型定義

// ============================================================================
// 集計粒度（タイムバケット）
// ============================================================================

/**
 * 時系列集計の時間粒度。
 *
 * バケット境界は `Granularity` に対応する PostgreSQL の `date_trunc` 単位と一致する:
 *  - hour:  毎時 00 分
 *  - day:   タイムゾーンの日初（00:00）
 *  - week:  ISO 週（月曜開始）
 *  - month: 月初（1 日 00:00）
 *
 * 新しい粒度を追加する場合は GRANULARITIES と
 * utils/dateRange.ts の GRANULARITY_SPECS に対応エントリを足す。
 */
export type Granularity = "hour" | "day" | "week" | "month";

/** 全 Granularity 値（バリデーション / イテレーション用） */
export const GRANULARITIES = ["hour", "day", "week", "month"] as const satisfies readonly Granularity[];

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
  /** タイムゾーン（IANA TZ名、デフォルト: Asia/Tokyo） */
  timezone?: string;
  /** 集計粒度（省略時は day で後方互換） */
  granularity?: Granularity;
  /**
   * dateFrom を granularity のバケット開始境界へ floor する（opt-in）。
   * week = ISO 月曜、month = 月初。day/hour は実質 no-op。
   * 非整列な dateFrom による先頭不完全バケットの過少計上を防ぐ。
   */
  alignToGranularity?: boolean;
};

/** 解決済みの日付範囲 */
export type ResolvedDateRange = {
  dateFrom: Date;
  dateTo: Date;
  dayCount: number;
  /** 適用されたタイムゾーン */
  timezone: string;
  /** 解決済みの集計粒度 */
  granularity: Granularity;
};

// ============================================================================
// 日別集計
// ============================================================================

/**
 * 時系列レコードの基底型。
 *
 * `date` フィールドは granularity により書式が変わる:
 *  - hour:  YYYY-MM-DDTHH:00
 *  - day:   YYYY-MM-DD
 *  - week:  YYYY-MM-DD（週開始日 = 月曜）
 *  - month: YYYY-MM
 *
 * 名称が `date` のまま残るのは後方互換のため。意味的には「バケットキー」。
 */
export type DailyRecord<T extends Record<string, unknown> = Record<string, unknown>> = {
  date: string;
} & T;

/** 内訳エントリの基底型 */
export type BreakdownEntry = {
  amount: number;
  count: number;
  uniqueUsers: number;
};

/** 時系列集計レスポンスの基底型 */
export type DailyAnalyticsResponse<T extends Record<string, unknown>> = {
  dateFrom: string;
  dateTo: string;
  /** 解決済みの集計粒度（クライアントの描画判別用） */
  granularity: Granularity;
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

/** ユーザーIDフィルタ */
export type UserIdFilter = {
  userId?: string;
};

/** ユーザー属性フィルタ（ロール ホワイトリスト + デモユーザー除外） */
export type UserFilter = {
  /** 含めるロール（CSV、未指定=全ロール） */
  roles?: string;
  /** デモユーザーを除外する */
  excludeDemo?: boolean;
};

/** ページネーション */
export type PaginationParams = {
  limit?: number;
  page?: number;
};
