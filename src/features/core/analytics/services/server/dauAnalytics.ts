// src/features/core/analytics/services/server/dauAnalytics.ts
// DAU集計サービス（日別DAU + サマリー + ユーザー別アクティブ日数ランキング + アクティブ日数ヒストグラム）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { UserDailyActivityTable } from "@/features/core/analytics/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { and, between, eq, sql, type SQL } from "drizzle-orm";
import type {
  DateRangeParams,
  DailyAnalyticsResponse,
  Granularity,
  PaginationParams,
  PeriodSummaryResponse,
  RankingResponse,
  UserFilter,
  UserIdFilter,
} from "@/features/core/analytics/types/common";
import { DEFAULT_RANKING_LIMIT, MAX_RANKING_LIMIT } from "@/features/core/analytics/constants";
import {
  resolveDateRange,
  generateDateKeys,
  formatDateKeyTz,
  formatDateRangeForResponse,
  assertGranularitySupported,
  derivePreviousRange,
  granularityDateExprForDateColumn,
} from "./utils/dateRange";
import { buildUserFilterConditions } from "./utils/userFilter";
import { changeRate } from "./utils/aggregation";
import { DomainError } from "@/lib/errors/domainError";

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

export type DauDailyData = {
  count: number;
};

export type DauSummaryData = {
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

/** ランキングエントリ（期間内のアクティブ日数 top-N） */
export type DauRankingEntry = {
  userId: string;
  displayName: string | null;
  /** 期間内にアクティビティが記録された日数 */
  activeDays: number;
  /** 期間内の最終アクティブ日（YYYY-MM-DD） */
  lastActiveDate: string;
};

/** ヒストグラムエントリ（アクティブ日数 → ユーザー数） */
export type DauActiveDaysHistogramEntry = {
  /** 期間内のアクティブ日数 */
  activeDays: number;
  /** ちょうど activeDays 日アクティブだったユーザー数 */
  users: number;
};

export type DauActiveDaysHistogramResponse = {
  dateFrom: string;
  dateTo: string;
  /** 期間内に1日以上アクティブだった総ユーザー数（histogram の users 合計と同値） */
  totalUsers: number;
  /** users > 0 の行のみ、activeDays ASC */
  histogram: DauActiveDaysHistogramEntry[];
};

/**
 * 期間内の「最終アクティブ日」（MAX(activity_date)）による絞り込み。
 * 日付キーは YYYY-MM-DD（activity_date と同じ TZ ローカル暦日）。
 * 集計結果への条件（HAVING）のためサーバー側でのみ解決できる。
 */
export type LastActiveDateFilter = {
  /** 最終アクティブ日がこの日以降のユーザーに絞る（復帰・リテンション分析用） */
  lastActiveDateFrom?: string;
  /** 最終アクティブ日がこの日以前のユーザーに絞る（チャーンリスク抽出用） */
  lastActiveDateTo?: string;
};

export type DauDailyParams = DateRangeParams & UserIdFilter & UserFilter;
export type DauSummaryParams = DateRangeParams & UserIdFilter & UserFilter;
export type DauRankingParams = DateRangeParams & PaginationParams & UserFilter & LastActiveDateFilter;
export type DauActiveDaysHistogramParams = DateRangeParams & UserFilter;

// ============================================================================
// テーブルエイリアス
// ============================================================================

const t = UserDailyActivityTable;
const u = UserTable;

// ============================================================================
// 条件ビルダー
// ============================================================================

function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  timezone: string,
  params: UserIdFilter & UserFilter,
): SQL[] {
  // activity_date は TZ ローカルの日付キー。toISOString()（UTC暦日）で文字列化すると
  // UTC より先行する TZ で下限が1日前にずれるため、必ず formatDateKeyTz を使う
  const dateFromStr = formatDateKeyTz(dateFrom, timezone);
  const dateToStr = formatDateKeyTz(dateTo, timezone);

  const conditions: SQL[] = [
    between(t.activityDate, dateFromStr, dateToStr),
    ...buildUserFilterConditions(t.userId, params),
  ];

  if (params.userId) {
    conditions.push(eq(t.userId, params.userId));
  }

  return conditions;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertValidDateKey(value: string, paramName: string): void {
  if (!DATE_KEY_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new DomainError(`${paramName} は YYYY-MM-DD 形式の有効な日付で指定してください。`);
  }
}

/**
 * 最終アクティブ日フィルタ → HAVING 条件（未指定なら undefined）。
 *
 * activity_date は date 型・TZ ローカル日付キーのため、
 * 日付キー文字列のまま比較する（Date オブジェクト化しない）。
 */
function buildLastActiveHaving(params: LastActiveDateFilter): SQL | undefined {
  const havingConditions: SQL[] = [];

  if (params.lastActiveDateFrom) {
    assertValidDateKey(params.lastActiveDateFrom, "lastActiveDateFrom");
    havingConditions.push(sql`MAX(${t.activityDate}) >= ${params.lastActiveDateFrom}`);
  }
  if (params.lastActiveDateTo) {
    assertValidDateKey(params.lastActiveDateTo, "lastActiveDateTo");
    havingConditions.push(sql`MAX(${t.activityDate}) <= ${params.lastActiveDateTo}`);
  }

  return havingConditions.length > 0 ? and(...havingConditions) : undefined;
}

// ============================================================================
// 日別DAU
// ============================================================================

/**
 * バケット別アクティブユーザー数（day=DAU / week=WAU / month=MAU）。
 *
 * `userId` 指定時は単一ユーザーへのドリルダウンになり、
 * day 粒度では 0/1 の系列（アクティビティカレンダー用途）を返す。
 */
export async function getDauDaily(
  params: DauDailyParams,
): Promise<DailyAnalyticsResponse<DauDailyData>> {
  const range = resolveDateRange(params);
  assertGranularitySupported(range.granularity, DAU_SUPPORTED_GRANULARITIES, "DAU 集計");
  const conditions = buildConditions(range.dateFrom, range.dateTo, range.timezone, params);
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

/**
 * DAU 期間サマリー。
 *
 * `userId` 指定時は単一ユーザーへのドリルダウンになり、
 * `totalActiveRecords` = そのユーザーの期間内アクティブ日数として読める。
 */
export async function getDauSummary(
  params: DauSummaryParams,
): Promise<PeriodSummaryResponse<DauSummaryData>> {
  const range = resolveDateRange(params);
  assertGranularitySupported(range.granularity, DAU_SUPPORTED_GRANULARITIES, "DAU 集計");

  const { dateFrom: prevDateFrom, dateTo: prevDateTo } = derivePreviousRange(range);

  // 当期と前期を並列取得
  const [currentDaily, prevDaily] = await Promise.all([
    getBucketCountsRaw(range.dateFrom, range.dateTo, range.timezone, range.granularity, params),
    getBucketCountsRaw(prevDateFrom, prevDateTo, range.timezone, range.granularity, params),
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
// ユーザー別アクティブ日数ランキング
// ============================================================================

/**
 * 期間内のアクティブ日数によるユーザーランキング（ページネーション付き）。
 *
 * `(user_id, activity_date)` はユニークのため `COUNT(*)` がそのまま
 * 「期間内のアクティブ日数（DISTINCT 日数）」になる。
 * 並び順: activeDays DESC → lastActiveDate DESC → userId ASC（安定ソート）。
 *
 * `lastActiveDateFrom` / `lastActiveDateTo` 指定時は期間内の最終アクティブ日
 * （MAX(activity_date)）で HAVING 絞り込みする（例: 「期間中は高アクティブ
 * だったが直近 N 日訪問なし」のチャーンリスク抽出）。`total` も同じ条件で
 * 数えるためページネーションは常に整合する。
 */
export async function getDauRanking(
  params: DauRankingParams,
): Promise<RankingResponse<DauRankingEntry>> {
  const range = resolveDateRange(params);
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_RANKING_LIMIT, 1), MAX_RANKING_LIMIT);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const conditions = buildConditions(range.dateFrom, range.dateTo, range.timezone, params);
  const lastActiveHaving = buildLastActiveHaving(params);

  // 総ユーザー数: HAVING はグループ化後の条件のため、フィルタ指定時のみ
  // 「GROUP BY user_id + HAVING」サブクエリの行数を数える形に切り替える
  const totalQuery = lastActiveHaving
    ? db
        .select({
          total: sql<number>`COUNT(*)::int`.as("total"),
        })
        .from(
          db
            .select({ userId: t.userId })
            .from(t)
            .where(and(...conditions))
            .groupBy(t.userId)
            .having(lastActiveHaving)
            .as("filtered_users"),
        )
    : db
        .select({
          total: sql<number>`COUNT(DISTINCT ${t.userId})::int`.as("total"),
        })
        .from(t)
        .where(and(...conditions));

  // ランキングクエリ（users JOIN）+ 総ユーザー数を並列実行
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        userId: t.userId,
        displayName: u.name,
        activeDays: sql<number>`COUNT(*)::int`.as("active_days"),
        lastActiveDate: sql<string>`MAX(${t.activityDate})::text`.as("last_active_date"),
      })
      .from(t)
      .leftJoin(u, eq(t.userId, u.id))
      .where(and(...conditions))
      .groupBy(t.userId, u.name)
      .having(lastActiveHaving)
      .orderBy(sql.raw("active_days DESC, last_active_date DESC"), t.userId)
      .limit(limit)
      .offset(offset),
    totalQuery,
  ]);
  const totalRow = totalRows[0];

  return {
    items: rows.map((r, idx) => ({
      rank: offset + idx + 1,
      userId: r.userId,
      displayName: r.displayName ?? null,
      activeDays: Number(r.activeDays),
      lastActiveDate: r.lastActiveDate,
    })),
    total: Number(totalRow!.total),
  };
}

// ============================================================================
// アクティブ日数ヒストグラム
// ============================================================================

/**
 * 期間内のアクティブ日数分布（ちょうど N 日アクティブだったユーザー数）。
 *
 * バケット化（割合しきい値等）はプロダクトポリシーのため下流の責務。
 * ここでは生のヒストグラムのみ返す。行数は期間日数で有界のためページネーション不要。
 * `totalUsers` は (user_id, activity_date) ユニークにより
 * histogram の users 合計 = DISTINCT ユーザー数となるため JS 側で合算する。
 */
export async function getDauActiveDaysHistogram(
  params: DauActiveDaysHistogramParams,
): Promise<DauActiveDaysHistogramResponse> {
  const range = resolveDateRange(params);
  const conditions = buildConditions(range.dateFrom, range.dateTo, range.timezone, params);

  const perUser = db
    .select({
      activeDays: sql<number>`COUNT(*)::int`.as("active_days"),
    })
    .from(t)
    .where(and(...conditions))
    .groupBy(t.userId)
    .as("per_user");

  const rows = await db
    .select({
      activeDays: perUser.activeDays,
      users: sql<number>`COUNT(*)::int`.as("users"),
    })
    .from(perUser)
    .groupBy(perUser.activeDays)
    .orderBy(perUser.activeDays);

  const histogram = rows.map((r) => ({
    activeDays: Number(r.activeDays),
    users: Number(r.users),
  }));

  return {
    dateFrom: formatDateKeyTz(range.dateFrom, range.timezone),
    dateTo: formatDateKeyTz(range.dateTo, range.timezone),
    totalUsers: histogram.reduce((sum, r) => sum + r.users, 0),
    histogram,
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** 指定期間のバケット別アクティブユーザー数を取得（統計計算用） */
async function getBucketCountsRaw(
  dateFrom: Date,
  dateTo: Date,
  timezone: string,
  granularity: Granularity,
  params: UserFilter,
): Promise<number[]> {
  const conditions = buildConditions(dateFrom, dateTo, timezone, params);
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
