// src/features/core/analytics/services/server/walletRankingAnalytics.ts
// ウォレット履歴ベースのランキング集計サービス
// データソース: wallet_histories（コイン/ポイント増減の台帳）
// 対比: purchaseRankingAnalytics.ts（purchase_requests ベース、決済情報を含む）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
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

/** ウォレットランキングのソート指標 */
export type WalletRankingSortBy =
  | "totalPurchase"
  | "totalConsumption"
  | "purchaseCount"
  | "netChange";

type WalletRankingEntry = {
  userId: string;
  displayName: string | null;
  totalPurchase: number;
  totalConsumption: number;
  purchaseCount: number;
  netChange: number;
  lastActivityAt: string | null;
};

export type WalletRankingParams = DateRangeParams & WalletTypeFilter & PaginationParams & UserFilter & {
  sortBy?: WalletRankingSortBy;
};

// ============================================================================
// SQL式ヘルパー
// ============================================================================

const t = WalletHistoryTable;
const u = UserTable;

/** 符号付きdelta（change_method考慮）のSQL式 */
const signedDeltaExpr = sql<number>`
  CASE
    WHEN ${t.change_method} = 'INCREMENT' THEN ${t.points_delta}
    WHEN ${t.change_method} = 'DECREMENT' THEN -${t.points_delta}
    WHEN ${t.change_method} = 'SET' THEN ${t.balance_after} - ${t.balance_before}
    ELSE 0
  END`;

/** ソート指標に対応するSQLエイリアス名 */
function resolveSortAlias(sortBy: WalletRankingSortBy): string {
  switch (sortBy) {
    case "totalPurchase":
      return "total_purchase";
    case "totalConsumption":
      return "total_consumption";
    case "purchaseCount":
      return "purchase_count";
    case "netChange":
      return "net_change";
  }
}

// ============================================================================
// ウォレットランキング
// ============================================================================

export async function getWalletRanking(
  params: WalletRankingParams,
): Promise<RankingResponse<WalletRankingEntry>> {
  const range = resolveDateRange(params);
  const sortBy = params.sortBy ?? "totalPurchase";
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_RANKING_LIMIT, 1), MAX_RANKING_LIMIT);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const conditions = buildConditions(range.dateFrom, range.dateTo, params);
  const sortAlias = resolveSortAlias(sortBy);

  // ランキングクエリ（users JOIN）+ 総ユーザー数を並列実行
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        userId: t.user_id,
        displayName: u.name,
        totalPurchase:
          sql<number>`COALESCE(SUM(CASE WHEN ${t.reason_category} = 'purchase' THEN ${t.points_delta} ELSE 0 END), 0)`.as(
            "total_purchase",
          ),
        totalConsumption:
          sql<number>`COALESCE(SUM(CASE WHEN ${t.reason_category} = 'consumption' THEN ${t.points_delta} ELSE 0 END), 0)`.as(
            "total_consumption",
          ),
        purchaseCount:
          sql<number>`SUM(CASE WHEN ${t.reason_category} = 'purchase' THEN 1 ELSE 0 END)::int`.as(
            "purchase_count",
          ),
        netChange:
          sql<number>`COALESCE(SUM(${signedDeltaExpr}), 0)`.as("net_change"),
        lastActivityAt:
          sql<string>`MAX(${t.createdAt})::text`.as("last_activity_at"),
      })
      .from(t)
      .leftJoin(u, eq(t.user_id, u.id))
      .where(and(...conditions))
      .groupBy(t.user_id, u.name)
      .orderBy(sql.raw(`${sortAlias} DESC`))
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
      displayName: r.displayName ?? null,
      totalPurchase: Number(r.totalPurchase),
      totalConsumption: Number(r.totalConsumption),
      purchaseCount: Number(r.purchaseCount),
      netChange: Number(r.netChange),
      lastActivityAt: r.lastActivityAt ?? null,
    })),
    total: Number(totalRow!.total),
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** フィルタ条件を構築（reason_categoryフィルタなし、全指標を一括集計） */
function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserFilter,
): SQL[] {
  const conditions: SQL[] = [
    between(t.createdAt, dateFrom, dateTo),
  ];

  // ユーザー属性フィルタ（roles ホワイトリスト + デモユーザー除外）
  conditions.push(...buildUserFilterConditions(t.user_id, params));

  if (params.walletType) {
    conditions.push(eq(t.type, params.walletType as "regular_coin" | "regular_point"));
  }

  return conditions;
}
