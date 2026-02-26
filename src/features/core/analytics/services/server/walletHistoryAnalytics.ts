// src/features/core/analytics/services/server/walletHistoryAnalytics.ts
// walletHistory 集計サービス（日別集計 + 期間サマリー + 日次残高）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { and, between, eq, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { ReasonCategory } from "@/config/app/wallet-reason-category.config";
import type {
  DateRangeParams,
  DailyAnalyticsResponse,
  PeriodSummaryResponse,
  BreakdownEntry,
  WalletTypeFilter,
  UserIdFilter,
  UserFilter,
} from "@/features/core/analytics/types/common";
import {
  resolveDateRange,
  generateDateKeys,
  formatDateRangeForResponse,
} from "./utils/dateRange";

import { buildUserFilterConditions } from "./utils/userFilter";

// ============================================================================
// 型定義
// ============================================================================

type WalletHistoryDailyData = {
  totalIncrement: number;
  totalDecrement: number;
  netChange: number;
  recordCount: number;
  uniqueUsers: number;
  breakdown: Record<string, BreakdownEntry>;
};

type WalletHistorySummaryData = {
  walletType: string | null;
  totalIncrement: number;
  totalDecrement: number;
  netChange: number;
  recordCount: number;
  uniqueUsers: number;
  byReasonCategory: Record<string, BreakdownEntry>;
};

export type WalletHistoryDailyParams = DateRangeParams & WalletTypeFilter & UserIdFilter & UserFilter & {
  /** 内訳の軸（デフォルト: "reasonCategory"） */
  groupBy?: "reasonCategory" | "sourceType" | "changeMethod";
  /** カテゴリフィルタ（CSV） */
  reasonCategories?: string;
};

export type WalletHistorySummaryParams = DateRangeParams & WalletTypeFilter & UserIdFilter & UserFilter;

type WalletBalanceDailyData = {
  /** その日の終了時点の残高（全対象ユーザー合計、またはuserId指定時はそのユーザー） */
  closingBalance: number;
  /** その日にアクティブだったユーザー数 */
  activeUsers: number;
  /** その日のレコード数 */
  recordCount: number;
};

export type WalletBalanceDailyParams = DateRangeParams & WalletTypeFilter & UserIdFilter & UserFilter;

// ============================================================================
// SQL式ヘルパー
// ============================================================================

const t = WalletHistoryTable;

/** タイムゾーン対応の日付抽出SQL式 */
function dateExpr(tz: string) {
  return sql<string>`DATE(${t.createdAt} AT TIME ZONE ${tz})`;
}

/** 符号付きdelta（change_method考慮）のSQL式 */
const signedDeltaExpr = sql<number>`
  CASE
    WHEN ${t.change_method} = 'INCREMENT' THEN ${t.points_delta}
    WHEN ${t.change_method} = 'DECREMENT' THEN -${t.points_delta}
    WHEN ${t.change_method} = 'SET' THEN ${t.balance_after} - ${t.balance_before}
    ELSE 0
  END`;

// ============================================================================
// 日別ウォレット変動集計
// ============================================================================

export async function getWalletHistoryDaily(
  params: WalletHistoryDailyParams,
): Promise<DailyAnalyticsResponse<WalletHistoryDailyData>> {
  const range = resolveDateRange(params);
  const tz = range.timezone;
  const groupByField = params.groupBy ?? "reasonCategory";

  const conditions = buildConditions(range.dateFrom, range.dateTo, params);
  const dateSql = dateExpr(tz);

  const groupColumn = resolveGroupColumn(groupByField);

  // メインクエリ + ブレイクダウンクエリを並列実行
  const [dailyRows, breakdownRows] = await Promise.all([
    db
      .select({
        date: dateSql,
        totalIncrement: sql<number>`COALESCE(SUM(CASE WHEN ${t.change_method} = 'INCREMENT' THEN ${t.points_delta} ELSE 0 END), 0)`.as("total_increment"),
        totalDecrement: sql<number>`COALESCE(SUM(CASE WHEN ${t.change_method} = 'DECREMENT' THEN ${t.points_delta} ELSE 0 END), 0)`.as("total_decrement"),
        netChange: sql<number>`COALESCE(SUM(${signedDeltaExpr}), 0)`.as("net_change"),
        recordCount: sql<number>`COUNT(*)::int`.as("record_count"),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${t.user_id})::int`.as("unique_users"),
      })
      .from(t)
      .where(and(...conditions))
      .groupBy(dateSql),
    db
      .select({
        date: dateSql,
        groupKey: sql<string>`${groupColumn}`.as("group_key"),
        amount: sql<number>`COALESCE(SUM(${signedDeltaExpr}), 0)`.as("amount"),
        count: sql<number>`COUNT(*)::int`.as("count"),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${t.user_id})::int`.as("unique_users"),
      })
      .from(t)
      .where(and(...conditions))
      .groupBy(dateSql, groupColumn),
  ]);

  // 結果をMap化
  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));
  const breakdownMap = new Map<string, Record<string, BreakdownEntry>>();
  for (const r of breakdownRows) {
    if (!breakdownMap.has(r.date)) {
      breakdownMap.set(r.date, {});
    }
    breakdownMap.get(r.date)![r.groupKey] = {
      amount: Number(r.amount),
      count: Number(r.count),
      uniqueUsers: Number(r.uniqueUsers),
    };
  }

  // データなし日を埋めてレスポンス構築
  const dateKeys = generateDateKeys(range);
  const emptyDay: WalletHistoryDailyData = {
    totalIncrement: 0, totalDecrement: 0, netChange: 0,
    recordCount: 0, uniqueUsers: 0, breakdown: {},
  };

  const history = dateKeys.map((date) => {
    const row = dailyMap.get(date);
    if (!row) return { date, ...emptyDay };
    return {
      date,
      totalIncrement: Number(row.totalIncrement),
      totalDecrement: Number(row.totalDecrement),
      netChange: Number(row.netChange),
      recordCount: Number(row.recordCount),
      uniqueUsers: Number(row.uniqueUsers),
      breakdown: breakdownMap.get(date) ?? {},
    };
  });

  return {
    ...formatDateRangeForResponse(range),
    history,
  };
}

// ============================================================================
// 期間サマリー
// ============================================================================

export async function getWalletHistorySummary(
  params: WalletHistorySummaryParams,
): Promise<PeriodSummaryResponse<WalletHistorySummaryData>> {
  const range = resolveDateRange(params);

  const conditions = buildConditions(range.dateFrom, range.dateTo, params);

  // メインクエリ + カテゴリ別ブレイクダウンを並列実行
  const [summaryRows, categoryRows] = await Promise.all([
    db
      .select({
        totalIncrement: sql<number>`COALESCE(SUM(CASE WHEN ${t.change_method} = 'INCREMENT' THEN ${t.points_delta} ELSE 0 END), 0)`.as("total_increment"),
        totalDecrement: sql<number>`COALESCE(SUM(CASE WHEN ${t.change_method} = 'DECREMENT' THEN ${t.points_delta} ELSE 0 END), 0)`.as("total_decrement"),
        netChange: sql<number>`COALESCE(SUM(${signedDeltaExpr}), 0)`.as("net_change"),
        recordCount: sql<number>`COUNT(*)::int`.as("record_count"),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${t.user_id})::int`.as("unique_users"),
      })
      .from(t)
      .where(and(...conditions)),
    db
      .select({
        category: sql<string>`${t.reason_category}`.as("category"),
        amount: sql<number>`COALESCE(SUM(${signedDeltaExpr}), 0)`.as("amount"),
        count: sql<number>`COUNT(*)::int`.as("count"),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${t.user_id})::int`.as("unique_users"),
      })
      .from(t)
      .where(and(...conditions))
      .groupBy(t.reason_category),
  ]);
  const summary = summaryRows[0];

  const byReasonCategory: Record<string, BreakdownEntry> = {};
  for (const r of categoryRows) {
    byReasonCategory[r.category] = {
      amount: Number(r.amount),
      count: Number(r.count),
      uniqueUsers: Number(r.uniqueUsers),
    };
  }

  return {
    ...formatDateRangeForResponse(range),
    walletType: params.walletType ?? null,
    totalIncrement: Number(summary!.totalIncrement),
    totalDecrement: Number(summary!.totalDecrement),
    netChange: Number(summary!.netChange),
    recordCount: Number(summary!.recordCount),
    uniqueUsers: Number(summary!.uniqueUsers),
    byReasonCategory,
  };
}

// ============================================================================
// 日次残高（ランニングバランス）
// ============================================================================

export async function getWalletBalanceDaily(
  params: WalletBalanceDailyParams,
): Promise<DailyAnalyticsResponse<WalletBalanceDailyData>> {
  const range = resolveDateRange(params);
  const tz = range.timezone;
  const dateSql = dateExpr(tz);

  const conditions = [
    between(t.createdAt, range.dateFrom, range.dateTo),
    ...buildBaseFilterConditions(params),
  ];

  // ベースライン + 日別ネット変動を並列実行
  const baselineConditions = [
    lte(t.createdAt, range.dateFrom),
    ...buildBaseFilterConditions(params),
  ];

  const [baselineRows, dailyRows] = await Promise.all([
    // 1. ベースライン: 期間開始前の全ユーザー残高合計（DISTINCT ON で各ユーザーの最新残高）
    db
      .select({
        total: sql<number>`COALESCE(SUM(sub.balance_after), 0)`.as("total"),
      })
      .from(
        db
          .selectDistinctOn([t.user_id], {
            balance_after: t.balance_after,
          })
          .from(t)
          .where(and(...baselineConditions))
          .orderBy(t.user_id, sql`${t.createdAt} DESC`)
          .as("sub"),
      ),
    // 2. 日別ネット変動 + アクティビティ
    db
      .select({
        date: dateSql,
        netChange: sql<number>`COALESCE(SUM(${signedDeltaExpr}), 0)`.as("net_change"),
        activeUsers: sql<number>`COUNT(DISTINCT ${t.user_id})::int`.as("active_users"),
        recordCount: sql<number>`COUNT(*)::int`.as("record_count"),
      })
      .from(t)
      .where(and(...conditions))
      .groupBy(dateSql),
  ]);

  const baselineBalance = Number(baselineRows[0]?.total ?? 0);

  const dailyMap = new Map(dailyRows.map((r) => [r.date, {
    netChange: Number(r.netChange),
    activeUsers: Number(r.activeUsers),
    recordCount: Number(r.recordCount),
  }]));

  // 3. ベースライン + 累積ネット変動 でランニングバランスを構築
  const dateKeys = generateDateKeys(range);
  let runningBalance = baselineBalance;

  const history = dateKeys.map((date) => {
    const row = dailyMap.get(date);
    runningBalance += row?.netChange ?? 0;
    return {
      date,
      closingBalance: runningBalance,
      activeUsers: row?.activeUsers ?? 0,
      recordCount: row?.recordCount ?? 0,
    };
  });

  return {
    ...formatDateRangeForResponse(range),
    history,
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** groupByフィールドから対応するカラムを返す */
function resolveGroupColumn(groupByField: "reasonCategory" | "sourceType" | "changeMethod") {
  switch (groupByField) {
    case "reasonCategory": return t.reason_category;
    case "sourceType": return t.source_type;
    case "changeMethod": return t.change_method;
  }
}

/** ユーザー/ウォレット/ロール等の共通フィルタ条件（日付条件なし） */
function buildBaseFilterConditions(
  params: WalletTypeFilter & UserIdFilter & UserFilter,
): SQL[] {
  const conditions: SQL[] = [];

  if (params.userId) {
    conditions.push(eq(t.user_id, params.userId));
  }

  conditions.push(...buildUserFilterConditions(t.user_id, params));

  if (params.walletType) {
    conditions.push(eq(t.type, params.walletType as "regular_coin" | "regular_point"));
  }

  return conditions;
}

/** 日付範囲 + 全フィルタの条件 */
function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserIdFilter & UserFilter & { reasonCategories?: string },
): SQL[] {
  const conditions: SQL[] = [
    between(t.createdAt, dateFrom, dateTo),
    ...buildBaseFilterConditions(params),
  ];

  if (params.reasonCategories) {
    const categories = params.reasonCategories.split(",").map((s) => s.trim()) as ReasonCategory[];
    if (categories.length === 1) {
      conditions.push(eq(t.reason_category, categories[0]!));
    } else if (categories.length > 1) {
      conditions.push(inArray(t.reason_category, categories));
    }
  }

  return conditions;
}

