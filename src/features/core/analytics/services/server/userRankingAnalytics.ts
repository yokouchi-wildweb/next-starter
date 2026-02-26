// src/features/core/analytics/services/server/userRankingAnalytics.ts
// ユーザーランキング集計サービス

import { db } from "@/lib/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { and, between, eq, type SQL } from "drizzle-orm";
import type {
  DateRangeParams,
  RankingResponse,
  WalletTypeFilter,
  PaginationParams,
  UserFilter,
} from "@/features/core/analytics/types/common";
import { DEFAULT_RANKING_LIMIT, MAX_RANKING_LIMIT } from "@/features/core/analytics/constants";
import { resolveDateRange } from "./utils/dateRange";
import { groupBy, sum } from "./utils/aggregation";
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
// DB型
// ============================================================================

type WalletHistoryRow = typeof WalletHistoryTable.$inferSelect;

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
  const records = await db
    .select()
    .from(WalletHistoryTable)
    .where(and(...conditions));

  // ユーザーごとにグルーピング
  const grouped = groupBy(records, (r) => r.user_id);

  // 各ユーザーの集計値を計算
  const userAggregates: UserRankingEntry[] = [];
  for (const [userId, userRecords] of grouped) {
    const totalAmount = computeMetricValue(userRecords, metric);
    const dates = userRecords
      .map((r) => r.createdAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    userAggregates.push({
      userId,
      totalAmount,
      count: userRecords.length,
      lastActivityAt: dates.length > 0 ? dates[0]!.toISOString() : null,
    });
  }

  // ソート（降順）
  userAggregates.sort((a, b) => b.totalAmount - a.totalAmount);

  const total = userAggregates.length;
  const paged = userAggregates.slice(offset, offset + limit);

  return {
    items: paged.map((entry, idx) => ({
      rank: offset + idx + 1,
      ...entry,
    })),
    total,
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
    between(WalletHistoryTable.createdAt, dateFrom, dateTo),
  ];

  // ユーザー属性フィルタ（roles ホワイトリスト + デモユーザー除外）
  conditions.push(...buildUserFilterConditions(WalletHistoryTable.user_id, params));

  if (params.walletType) {
    conditions.push(eq(WalletHistoryTable.type, params.walletType as "regular_coin" | "regular_point"));
  }

  // メトリクスに応じたフィルタ
  switch (metric) {
    case "totalPurchase":
      conditions.push(eq(WalletHistoryTable.reason_category, "purchase"));
      break;
    case "totalConsumption":
      conditions.push(eq(WalletHistoryTable.reason_category, "consumption"));
      break;
    case "purchaseCount":
      conditions.push(eq(WalletHistoryTable.reason_category, "purchase"));
      break;
    // netChange: フィルタなし（全レコード対象）
  }

  return conditions;
}

function computeMetricValue(records: WalletHistoryRow[], metric: RankingMetric): number {
  switch (metric) {
    case "totalPurchase":
      return sum(records.map((r) => r.points_delta));
    case "totalConsumption":
      return sum(records.map((r) => r.points_delta));
    case "purchaseCount":
      return records.length;
    case "netChange":
      return sum(records.map((r) => resolveSignedDelta(r)));
  }
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
