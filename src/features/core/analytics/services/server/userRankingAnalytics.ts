// src/features/core/analytics/services/server/userRankingAnalytics.ts
// ユーザーランキング集計サービス
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { and, between, eq, sql, type SQL } from "drizzle-orm";
import type {
  DateRangeParams,
  RankingResponse,
  WalletTypeFilter,
  PaginationParams,
  UserFilter,
} from "@/features/core/analytics/types/common";
import { DEFAULT_RANKING_LIMIT, MAX_RANKING_LIMIT } from "@/features/core/analytics/constants";
import { resolveDateRange } from "./utils/dateRange";
import { buildUserFilterConditions } from "./utils/userFilter";

// ============================================================================
// 型定義
// ============================================================================

/** ランキング指標 */
export type RankingMetric =
  | "totalPurchase"
  | "totalConsumption"
  | "purchaseCount"
  | "netChange";

type UserRankingEntry = {
  userId: string;
  totalAmount: number;
  count: number;
  lastActivityAt: string | null;
};

export type UserRankingParams = DateRangeParams & WalletTypeFilter & PaginationParams & UserFilter & {
  metric?: RankingMetric;
};

// ============================================================================
// SQL式ヘルパー
// ============================================================================

const t = WalletHistoryTable;

/** 符号付きdelta（change_method考慮）のSQL式 */
const signedDeltaExpr = sql<number>`
  CASE
    WHEN ${t.change_method} = 'INCREMENT' THEN ${t.points_delta}
    WHEN ${t.change_method} = 'DECREMENT' THEN -${t.points_delta}
    WHEN ${t.change_method} = 'SET' THEN ${t.balance_after} - ${t.balance_before}
    ELSE 0
  END`;

/** メトリクスに応じた集計SQL式 */
function resolveMetricExpr(metric: RankingMetric) {
  switch (metric) {
    case "totalPurchase":
    case "totalConsumption":
      return sql<number>`COALESCE(SUM(${t.points_delta}), 0)`;
    case "purchaseCount":
      return sql<number>`COUNT(*)::int`;
    case "netChange":
      return sql<number>`COALESCE(SUM(${signedDeltaExpr}), 0)`;
  }
}

// ============================================================================
// ユーザーランキング
// ============================================================================

export async function getUserRanking(
  params: UserRankingParams,
): Promise<RankingResponse<UserRankingEntry>> {
  const range = resolveDateRange(params);
  const metric = params.metric ?? "totalPurchase";
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_RANKING_LIMIT, 1), MAX_RANKING_LIMIT);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const conditions = buildConditions(range.dateFrom, range.dateTo, params, metric);
  const metricSql = resolveMetricExpr(metric);

  // ランキングクエリ + 総ユーザー数を並列実行
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        userId: t.user_id,
        totalAmount: metricSql.as("total_amount"),
        count: sql<number>`COUNT(*)::int`.as("count"),
        lastActivityAt: sql<string>`MAX(${t.createdAt})::text`.as("last_activity_at"),
      })
      .from(t)
      .where(and(...conditions))
      .groupBy(t.user_id)
      .orderBy(sql`total_amount DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({
        total: sql<number>`COUNT(DISTINCT ${t.user_id})::int`.as("total"),
      })
      .from(t)
      .where(and(...conditions)),
  ]);
  const totalRow = totalRows[0];

  return {
    items: rows.map((r, idx) => ({
      rank: offset + idx + 1,
      userId: r.userId,
      totalAmount: Number(r.totalAmount),
      count: Number(r.count),
      lastActivityAt: r.lastActivityAt ?? null,
    })),
    total: Number(totalRow!.total),
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserFilter,
  metric: RankingMetric,
): SQL[] {
  const conditions: SQL[] = [
    between(t.createdAt, dateFrom, dateTo),
  ];

  // ユーザー属性フィルタ（roles ホワイトリスト + デモユーザー除外）
  conditions.push(...buildUserFilterConditions(t.user_id, params));

  if (params.walletType) {
    conditions.push(eq(t.type, params.walletType as "regular_coin" | "regular_point"));
  }

  // メトリクスに応じたreason_categoryフィルタ
  switch (metric) {
    case "totalPurchase":
    case "purchaseCount":
      conditions.push(eq(t.reason_category, "purchase"));
      break;
    case "totalConsumption":
      conditions.push(eq(t.reason_category, "consumption"));
      break;
    // netChange: フィルタなし（全レコード対象）
  }

  return conditions;
}
