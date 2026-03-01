// src/features/core/analytics/services/server/dauAnalytics.ts
// DAU集計サービス（日別DAU + サマリー）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { UserDailyActivityTable } from "@/features/core/analytics/entities/drizzle";
import { and, between, sql, type SQL } from "drizzle-orm";
import type {
  DateRangeParams,
  DailyAnalyticsResponse,
  PeriodSummaryResponse,
  UserFilter,
} from "@/features/core/analytics/types/common";
import {
  resolveDateRange,
  generateDateKeys,
  formatDateRangeForResponse,
} from "./utils/dateRange";
import { buildUserFilterConditions } from "./utils/userFilter";
import { changeRate } from "./utils/aggregation";

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
  const conditions = buildConditions(range.dateFrom, range.dateTo, params);

  const dailyRows = await db
    .select({
      date: sql<string>`${t.activityDate}::text`.as("date"),
      count: sql<number>`COUNT(DISTINCT ${t.userId})::int`.as("count"),
    })
    .from(t)
    .where(and(...conditions))
    .groupBy(t.activityDate)
    .orderBy(t.activityDate);

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

  // 前期の日付範囲
  const prevDateFrom = new Date(range.dateFrom);
  prevDateFrom.setDate(prevDateFrom.getDate() - range.dayCount);
  const prevDateTo = new Date(range.dateFrom);
  prevDateTo.setMilliseconds(prevDateTo.getMilliseconds() - 1);

  // 当期と前期を並列取得
  const [currentDaily, prevDaily] = await Promise.all([
    getDailyCountsRaw(range.dateFrom, range.dateTo, params),
    getDailyCountsRaw(prevDateFrom, prevDateTo, params),
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

/** 指定期間の日別DAUカウントを取得（統計計算用） */
async function getDailyCountsRaw(
  dateFrom: Date,
  dateTo: Date,
  params: UserFilter,
): Promise<number[]> {
  const conditions = buildConditions(dateFrom, dateTo, params);

  const rows = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${t.userId})::int`.as("count"),
    })
    .from(t)
    .where(and(...conditions))
    .groupBy(t.activityDate);

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
