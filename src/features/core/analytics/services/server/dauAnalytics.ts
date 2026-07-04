// src/features/core/analytics/services/server/dauAnalytics.ts
// DAU集計サービス（日別DAU + サマリー）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { UserDailyActivityTable } from "@/features/core/analytics/entities/drizzle";
import { and, between, sql, type SQL } from "drizzle-orm";
import type {
  DateRangeParams,
  DailyAnalyticsResponse,
  Granularity,
  PeriodSummaryResponse,
  UserFilter,
} from "@/features/core/analytics/types/common";
import {
  resolveDateRange,
  generateDateKeys,
  formatDateRangeForResponse,
  assertGranularitySupported,
  derivePreviousRange,
  granularityDateExprForDateColumn,
} from "./utils/dateRange";
import { buildUserFilterConditions } from "./utils/userFilter";
import { changeRate } from "./utils/aggregation";

/**
 * DAU が対応する集計粒度。
 *
 * `UserDailyActivityTable` は date 型 (activity_date) で日次集計済みのため、
 * 日未満 (hour) は不可。week/month は user_id を保持しているため
 * バケット内ユニークユーザー（週 = WAU、月 = MAU）として集計する。
 * 「日次 DAU の合計」ではない点に注意（同一ユーザーはバケット内で 1 カウント）。
 */
export const DAU_SUPPORTED_GRANULARITIES = ["day", "week", "month"] as const satisfies readonly Granularity[];

// ============================================================================
// 型定義
// ============================================================================

type DauDailyData = {
  count: number;
};

type DauSummaryData = {
  totalDays: number;
  totalActiveRecords: number;
  avgDau: number;
  maxDau: number;
  minDau: number;
  comparison: {
    previousPeriod: {
      avgDau: number;
      changeRate: {
        avgDau: number | null;
      };
    };
  };
};

export type DauDailyParams = DateRangeParams & UserFilter;
export type DauSummaryParams = DateRangeParams & UserFilter;

// ============================================================================
// テーブルエイリアス
// ============================================================================

const t = UserDailyActivityTable;

// ============================================================================
// 条件ビルダー
// ============================================================================

function buildConditions(dateFrom: Date, dateTo: Date, params: UserFilter): SQL[] {
  const dateFromStr = dateFrom.toISOString().split("T")[0]!;
  const dateToStr = dateTo.toISOString().split("T")[0]!;

  return [
    between(t.activityDate, dateFromStr, dateToStr),
    ...buildUserFilterConditions(t.userId, params),
  ];
}

// ============================================================================
// 日別DAU
// ============================================================================

export async function getDauDaily(
  params: DauDailyParams,
): Promise<DailyAnalyticsResponse<DauDailyData>> {
  const range = resolveDateRange(params);
  assertGranularitySupported(range.granularity, DAU_SUPPORTED_GRANULARITIES, "DAU 集計");
  const conditions = buildConditions(range.dateFrom, range.dateTo, params);
  const dateSql = granularityDateExprForDateColumn(t.activityDate, range.granularity);

  const dailyRows = await db
    .select({
      date: dateSql,
      count: sql<number>`COUNT(DISTINCT ${t.userId})::int`.as("count"),
    })
    .from(t)
    .where(and(...conditions))
    .groupBy(sql.raw("1"));

  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));

  const dateKeys = generateDateKeys(range);
  const history = dateKeys.map((date) => {
    const row = dailyMap.get(date);
    return {
      date,
      count: row ? Number(row.count) : 0,
    };
  });

  return { ...formatDateRangeForResponse(range), history };
}

// ============================================================================
// DAUサマリー
// ============================================================================

export async function getDauSummary(
  params: DauSummaryParams,
): Promise<PeriodSummaryResponse<DauSummaryData>> {
  const range = resolveDateRange(params);
  assertGranularitySupported(range.granularity, DAU_SUPPORTED_GRANULARITIES, "DAU 集計");

  const { dateFrom: prevDateFrom, dateTo: prevDateTo } = derivePreviousRange(range);

  // 当期と前期を並列取得
  const [currentDaily, prevDaily] = await Promise.all([
    getBucketCountsRaw(range.dateFrom, range.dateTo, range.granularity, params),
    getBucketCountsRaw(prevDateFrom, prevDateTo, range.granularity, params),
  ]);

  const currentStats = computeStats(currentDaily);
  const prevStats = computeStats(prevDaily);

  return {
    ...formatDateRangeForResponse(range),
    totalDays: range.dayCount,
    totalActiveRecords: currentStats.total,
    avgDau: currentStats.avg,
    maxDau: currentStats.max,
    minDau: currentStats.min,
    comparison: {
      previousPeriod: {
        avgDau: prevStats.avg,
        changeRate: {
          avgDau: changeRate(currentStats.avg, prevStats.avg),
        },
      },
    },
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** 指定期間のバケット別アクティブユーザー数を取得（統計計算用） */
async function getBucketCountsRaw(
  dateFrom: Date,
  dateTo: Date,
  granularity: Granularity,
  params: UserFilter,
): Promise<number[]> {
  const conditions = buildConditions(dateFrom, dateTo, params);
  const dateSql = granularityDateExprForDateColumn(t.activityDate, granularity);

  const rows = await db
    .select({
      date: dateSql,
      count: sql<number>`COUNT(DISTINCT ${t.userId})::int`.as("count"),
    })
    .from(t)
    .where(and(...conditions))
    .groupBy(sql.raw("1"));

  return rows.map((r) => Number(r.count));
}

/** DAUカウント配列から統計値を計算 */
function computeStats(dailyCounts: number[]) {
  if (dailyCounts.length === 0) {
    return { total: 0, avg: 0, max: 0, min: 0 };
  }

  const total = dailyCounts.reduce((sum, c) => sum + c, 0);
  const avg = Math.round(total / dailyCounts.length);
  const max = Math.max(...dailyCounts);
  const min = Math.min(...dailyCounts);

  return { total, avg, max, min };
}
