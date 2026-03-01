// src/features/core/analytics/services/server/userAnalytics.ts
// ユーザー集計サービス（日別新規登録 + 登録サマリー + ステータス概況）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { and, between, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
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
import { changeRate } from "./utils/aggregation";

// ============================================================================
// 型定義
// ============================================================================

type RegistrationDailyData = {
  count: number;
};

type ProviderBreakdown = {
  count: number;
};

type RoleBreakdown = {
  count: number;
};

type RegistrationSummaryData = {
  totalCount: number;
  byProvider: Record<string, ProviderBreakdown>;
  byRole: Record<string, RoleBreakdown>;
  comparison: {
    previousPeriod: {
      totalCount: number;
      changeRate: {
        count: number | null;
      };
    };
  };
};

type UserStatusCount = {
  count: number;
  demoCount: number;
};

type UserStatusOverviewData = {
  total: number;
  current: Record<string, UserStatusCount>;
};

export type RegistrationDailyParams = DateRangeParams & UserFilter;
export type RegistrationSummaryParams = DateRangeParams & UserFilter;

// ============================================================================
// SQL式ヘルパー
// ============================================================================

const u = UserTable;

/** グルーピング用日付式（created_at をタイムゾーン変換して日付にキャスト） */
function registrationDateExpr(tz: string) {
  return sql<string>`DATE(${u.createdAt} AT TIME ZONE ${tz})::text`;
}

/** UserTable に対する直接フィルタ条件（サブクエリではなくカラム直接参照） */
function buildUserTableFilterConditions(params: UserFilter): SQL[] {
  const conditions: SQL[] = [];

  if (params.roles) {
    const roleList = params.roles.split(",").map((s) => s.trim()).filter(Boolean);
    if (roleList.length > 0) {
      conditions.push(inArray(u.role, roleList as [string, ...string[]]));
    }
  }

  if (params.excludeDemo) {
    conditions.push(eq(u.isDemo, false));
  }

  return conditions;
}

/** 日付範囲 + フィルタ条件（ソフトデリート除外含む） */
function buildConditions(dateFrom: Date, dateTo: Date, params: UserFilter): SQL[] {
  return [
    between(u.createdAt, dateFrom, dateTo),
    isNull(u.deletedAt),
    ...buildUserTableFilterConditions(params),
  ];
}

// ============================================================================
// 日別新規登録数
// ============================================================================

export async function getUserRegistrationDaily(
  params: RegistrationDailyParams,
): Promise<DailyAnalyticsResponse<RegistrationDailyData>> {
  const range = resolveDateRange(params);
  const tz = range.timezone;

  const conditions = buildConditions(range.dateFrom, range.dateTo, params);
  const dateSql = registrationDateExpr(tz);

  const dailyRows = await db
    .select({
      date: dateSql,
      count: sql<number>`COUNT(*)::int`.as("count"),
    })
    .from(u)
    .where(and(...conditions))
    .groupBy(sql.raw("1"));

  // Map化
  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));

  // データなし日を埋めてレスポンス構築
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
// 登録サマリー
// ============================================================================

export async function getUserRegistrationSummary(
  params: RegistrationSummaryParams,
): Promise<PeriodSummaryResponse<RegistrationSummaryData>> {
  const range = resolveDateRange(params);

  const conditions = buildConditions(range.dateFrom, range.dateTo, params);

  // 前期の日付範囲
  const prevDateFrom = new Date(range.dateFrom);
  prevDateFrom.setDate(prevDateFrom.getDate() - range.dayCount);
  const prevDateTo = new Date(range.dateFrom);
  prevDateTo.setMilliseconds(prevDateTo.getMilliseconds() - 1);

  // 当期+前期を1クエリで集計するための条件
  const unifiedConditions: SQL[] = [
    between(u.createdAt, prevDateFrom, range.dateTo),
    isNull(u.deletedAt),
    ...buildUserTableFilterConditions(params),
  ];
  const isCurrent = sql`(${u.createdAt} >= ${range.dateFrom.toISOString()} AND ${u.createdAt} <= ${range.dateTo.toISOString()})`;
  const isPrev = sql`(${u.createdAt} >= ${prevDateFrom.toISOString()} AND ${u.createdAt} <= ${prevDateTo.toISOString()})`;

  // 3クエリを並列実行
  const [summaryRows, providerRows, roleRows] = await Promise.all([
    // 1. メイン集計 + 前期比較（CASE WHENで1クエリ化）
    db
      .select({
        totalCount: sql<number>`SUM(CASE WHEN ${isCurrent} THEN 1 ELSE 0 END)::int`.as("total_count"),
        prevCount: sql<number>`SUM(CASE WHEN ${isPrev} THEN 1 ELSE 0 END)::int`.as("prev_count"),
      })
      .from(u)
      .where(and(...unifiedConditions)),
    // 2. プロバイダ別内訳（当期のみ）
    db
      .select({
        provider: sql<string>`${u.providerType}`.as("provider"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(u)
      .where(and(...conditions))
      .groupBy(u.providerType),
    // 3. ロール別内訳（当期のみ）
    db
      .select({
        role: sql<string>`${u.role}`.as("role"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(u)
      .where(and(...conditions))
      .groupBy(u.role),
  ]);

  const summary = summaryRows[0];
  const totalCount = Number(summary!.totalCount);
  const prevCount = Number(summary!.prevCount);

  // プロバイダ別
  const byProvider: Record<string, ProviderBreakdown> = {};
  for (const r of providerRows) {
    byProvider[r.provider] = { count: Number(r.count) };
  }

  // ロール別
  const byRole: Record<string, RoleBreakdown> = {};
  for (const r of roleRows) {
    byRole[r.role] = { count: Number(r.count) };
  }

  return {
    ...formatDateRangeForResponse(range),
    totalCount,
    byProvider,
    byRole,
    comparison: {
      previousPeriod: {
        totalCount: prevCount,
        changeRate: {
          count: changeRate(totalCount, prevCount),
        },
      },
    },
  };
}

// ============================================================================
// ステータス概況
// ============================================================================

export async function getUserStatusOverview(): Promise<UserStatusOverviewData> {
  // ステータス別集計（デモユーザー内訳含む、ソフトデリート除外）
  const statusRows = await db
    .select({
      status: sql<string>`${u.status}`.as("status"),
      count: sql<number>`COUNT(*)::int`.as("count"),
      demoCount: sql<number>`SUM(CASE WHEN ${u.isDemo} = true THEN 1 ELSE 0 END)::int`.as("demo_count"),
    })
    .from(u)
    .where(isNull(u.deletedAt))
    .groupBy(u.status);

  // 全ステータスを網羅して結果構築
  const statuses = ["pending", "active", "inactive", "suspended", "banned", "security_locked", "withdrawn"] as const;
  const current: Record<string, UserStatusCount> = {};
  const statusMap = new Map(statusRows.map((r) => [r.status, r]));

  let total = 0;
  for (const status of statuses) {
    const row = statusMap.get(status);
    const count = row ? Number(row.count) : 0;
    const demoCount = row ? Number(row.demoCount) : 0;
    current[status] = { count, demoCount };
    total += count;
  }

  return { total, current };
}
