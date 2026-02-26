// src/features/core/analytics/services/server/walletHistoryAnalytics.ts
// walletHistory 集計サービス（日別集計 + 期間サマリー + 日次残高）

import { db } from "@/lib/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { and, between, eq, inArray, lte, type SQL } from "drizzle-orm";
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
import { groupByDate, countUnique } from "./utils/aggregation";
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
// DB型
// ============================================================================

type WalletHistoryRow = typeof WalletHistoryTable.$inferSelect;

// ============================================================================
// 日別ウォレット変動集計
// ============================================================================

export async function getWalletHistoryDaily(
  params: WalletHistoryDailyParams,
): Promise<DailyAnalyticsResponse<WalletHistoryDailyData>> {
  const range = resolveDateRange(params);
  const groupByField = params.groupBy ?? "reasonCategory";

  const conditions = buildConditions(range.dateFrom, range.dateTo, params);
  const records = await db
    .select()
    .from(WalletHistoryTable)
    .where(and(...conditions));

  const grouped = groupByDate(records, (r) => r.createdAt, range.timezone);
  const dateKeys = generateDateKeys(range);

  const history = dateKeys.map((date) => {
    const dayRecords = grouped.get(date) ?? [];
    return {
      date,
      ...aggregateDailyRecords(dayRecords, groupByField),
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
  const records = await db
    .select()
    .from(WalletHistoryTable)
    .where(and(...conditions));

  const totalIncrement = sumByMethod(records, "INCREMENT");
  const totalDecrement = sumByMethod(records, "DECREMENT");
  const setDelta = sumSetDelta(records);

  return {
    ...formatDateRangeForResponse(range),
    walletType: params.walletType ?? null,
    totalIncrement,
    totalDecrement: totalDecrement,
    netChange: totalIncrement - totalDecrement + setDelta,
    recordCount: records.length,
    uniqueUsers: countUnique(records, (r) => r.user_id),
    byReasonCategory: buildBreakdown(records, (r) => r.reason_category),
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

  // 期間内のレコード取得（ユーザーフィルタ適用）
  const conditions = buildBalanceConditions(range.dateFrom, range.dateTo, params);
  const records = await db
    .select()
    .from(WalletHistoryTable)
    .where(and(...conditions));

  // 期間開始前の最新レコードも取得（初日の残高ベースライン用）
  const baselineConditions = buildBalanceBaselineConditions(range.dateFrom, params);
  const baselineRecords = await db
    .select()
    .from(WalletHistoryTable)
    .where(and(...baselineConditions));

  // ベースラインはユーザーごとに最新のレコードを使用
  const userBaselineMap = buildUserLatestBalance(baselineRecords);

  // 期間内レコードを日付でグルーピング
  const grouped = groupByDate(records, (r) => r.createdAt, tz);
  const dateKeys = generateDateKeys(range);

  // 日ごとに各ユーザーのclosingBalanceを追跡
  const runningBalance = new Map<string, number>(userBaselineMap);

  const history = dateKeys.map((date) => {
    const dayRecords = grouped.get(date) ?? [];

    // この日のアクティブユーザー
    const activeUserIds = new Set<string>();
    for (const r of dayRecords) {
      activeUserIds.add(r.user_id);
    }

    // この日にレコードがあるユーザーの残高を更新
    const dayLatest = buildUserLatestBalance(dayRecords);
    for (const [userId, balance] of dayLatest) {
      runningBalance.set(userId, balance);
    }

    // closingBalance: 全ユーザーの現在残高合計
    let closingBalance = 0;
    for (const balance of runningBalance.values()) {
      closingBalance += balance;
    }

    return {
      date,
      closingBalance,
      activeUsers: activeUserIds.size,
      recordCount: dayRecords.length,
    };
  });

  return {
    ...formatDateRangeForResponse(range),
    history,
  };
}

/**
 * レコード配列からユーザーごとの最新balance_afterを算出
 */
function buildUserLatestBalance(records: WalletHistoryRow[]): Map<string, number> {
  const latestMap = new Map<string, { balance: number; time: number }>();

  for (const r of records) {
    const time = r.createdAt?.getTime() ?? 0;
    const existing = latestMap.get(r.user_id);
    if (!existing || time >= existing.time) {
      latestMap.set(r.user_id, { balance: r.balance_after, time });
    }
  }

  const result = new Map<string, number>();
  for (const [userId, data] of latestMap) {
    result.set(userId, data.balance);
  }
  return result;
}

/**
 * 残高集計用の条件（reasonCategoriesフィルタなし）
 */
function buildBalanceConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserIdFilter & UserFilter,
): SQL[] {
  const conditions: SQL[] = [
    between(WalletHistoryTable.createdAt, dateFrom, dateTo),
  ];

  if (params.userId) {
    conditions.push(eq(WalletHistoryTable.user_id, params.userId));
  }

  conditions.push(...buildUserFilterConditions(WalletHistoryTable.user_id, params));

  if (params.walletType) {
    conditions.push(eq(WalletHistoryTable.type, params.walletType as "regular_coin" | "regular_point"));
  }

  return conditions;
}

/**
 * ベースライン取得用の条件（dateFrom以前のレコード）
 */
function buildBalanceBaselineConditions(
  dateFrom: Date,
  params: WalletTypeFilter & UserIdFilter & UserFilter,
): SQL[] {
  const conditions: SQL[] = [
    lte(WalletHistoryTable.createdAt, dateFrom),
  ];

  if (params.userId) {
    conditions.push(eq(WalletHistoryTable.user_id, params.userId));
  }

  conditions.push(...buildUserFilterConditions(WalletHistoryTable.user_id, params));

  if (params.walletType) {
    conditions.push(eq(WalletHistoryTable.type, params.walletType as "regular_coin" | "regular_point"));
  }

  return conditions;
}

// ============================================================================
// 内部ヘルパー（変動集計用）
// ============================================================================

function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserIdFilter & UserFilter & { reasonCategories?: string },
): SQL[] {
  const conditions: SQL[] = [
    between(WalletHistoryTable.createdAt, dateFrom, dateTo),
  ];

  if (params.userId) {
    conditions.push(eq(WalletHistoryTable.user_id, params.userId));
  }

  // ユーザー属性フィルタ（roles ホワイトリスト + デモユーザー除外）
  conditions.push(...buildUserFilterConditions(WalletHistoryTable.user_id, params));

  if (params.walletType) {
    conditions.push(eq(WalletHistoryTable.type, params.walletType as "regular_coin" | "regular_point"));
  }

  if (params.reasonCategories) {
    const categories = params.reasonCategories.split(",").map((s) => s.trim()) as ReasonCategory[];
    if (categories.length === 1) {
      conditions.push(eq(WalletHistoryTable.reason_category, categories[0]!));
    } else if (categories.length > 1) {
      conditions.push(inArray(WalletHistoryTable.reason_category, categories));
    }
  }

  return conditions;
}

function aggregateDailyRecords(
  records: WalletHistoryRow[],
  groupByField: "reasonCategory" | "sourceType" | "changeMethod",
): WalletHistoryDailyData {
  const totalIncrement = sumByMethod(records, "INCREMENT");
  const totalDecrement = sumByMethod(records, "DECREMENT");
  const setDelta = sumSetDelta(records);

  const getKey = (r: WalletHistoryRow): string => {
    switch (groupByField) {
      case "reasonCategory": return r.reason_category;
      case "sourceType": return r.source_type;
      case "changeMethod": return r.change_method;
    }
  };

  return {
    totalIncrement,
    totalDecrement,
    netChange: totalIncrement - totalDecrement + setDelta,
    recordCount: records.length,
    uniqueUsers: countUnique(records, (r) => r.user_id),
    breakdown: buildBreakdown(records, getKey),
  };
}

function buildBreakdown(
  records: WalletHistoryRow[],
  getKey: (r: WalletHistoryRow) => string,
): Record<string, BreakdownEntry> {
  const breakdown: Record<string, BreakdownEntry> = {};

  for (const record of records) {
    const key = getKey(record);
    if (!breakdown[key]) {
      breakdown[key] = { amount: 0, count: 0, uniqueUsers: 0 };
    }
    breakdown[key].amount += resolveSignedDelta(record);
    breakdown[key].count += 1;
  }

  // uniqueUsers を各グループごとに計算
  const groupedUsers: Record<string, Set<string>> = {};
  for (const record of records) {
    const key = getKey(record);
    if (!groupedUsers[key]) {
      groupedUsers[key] = new Set();
    }
    groupedUsers[key].add(record.user_id);
  }
  for (const key of Object.keys(breakdown)) {
    breakdown[key]!.uniqueUsers = groupedUsers[key]?.size ?? 0;
  }

  return breakdown;
}

function sumByMethod(records: WalletHistoryRow[], method: "INCREMENT" | "DECREMENT"): number {
  let total = 0;
  for (const r of records) {
    if (r.change_method === method) {
      total += r.points_delta;
    }
  }
  return total;
}

function sumSetDelta(records: WalletHistoryRow[]): number {
  let total = 0;
  for (const r of records) {
    if (r.change_method === "SET") {
      total += r.balance_after - r.balance_before;
    }
  }
  return total;
}

function resolveSignedDelta(record: WalletHistoryRow): number {
  if (record.change_method === "DECREMENT") {
    return -record.points_delta;
  }
  if (record.change_method === "SET") {
    return record.balance_after - record.balance_before;
  }
  return record.points_delta;
}
