// src/features/core/analytics/services/server/purchaseRankingAnalytics.ts
// 購入リクエストベースのランキング集計サービス
// データソース: purchase_requests（決済トランザクション）
// 対比: walletRankingAnalytics.ts（wallet_histories ベース、コイン/ポイント増減の台帳）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { and, between, eq, sql, type SQL } from "drizzle-orm";
import type {
  DateRangeParams,
  RankingResponse,
  WalletTypeFilter,
  PaginationParams,
  UserFilter,
} from "@/features/core/analytics/types/common";
import {
  DEFAULT_PURCHASE_RANKING_LIMIT,
  MAX_PURCHASE_RANKING_LIMIT,
} from "@/features/core/analytics/constants";
import { resolveDateRange } from "./utils/dateRange";
import { buildUserFilterConditions } from "./utils/userFilter";

// ============================================================================
// 型定義
// ============================================================================

/** 購入ランキングのソート指標 */
export type PurchaseRankingSortBy =
  | "totalCoinAmount"
  | "totalPaymentAmount"
  | "purchaseCount"
  | "avgPaymentAmount";

type PurchaseRankingEntry = {
  userId: string;
  displayName: string | null;
  totalCoinAmount: number;
  totalPaymentAmount: number;
  purchaseCount: number;
  avgPaymentAmount: number;
  lastPurchaseAt: string | null;
};

export type PurchaseRankingParams = DateRangeParams &
  WalletTypeFilter &
  PaginationParams &
  UserFilter & {
    sortBy?: PurchaseRankingSortBy;
    paymentProvider?: string;
  };

// ============================================================================
// SQL式ヘルパー
// ============================================================================

const p = PurchaseRequestTable;
const u = UserTable;

/** ソート指標に対応する集計SQL式のエイリアス名 */
function resolveSortAlias(sortBy: PurchaseRankingSortBy): string {
  switch (sortBy) {
    case "totalCoinAmount":
      return "total_coin_amount";
    case "totalPaymentAmount":
      return "total_payment_amount";
    case "purchaseCount":
      return "purchase_count";
    case "avgPaymentAmount":
      return "avg_payment_amount";
  }
}

// ============================================================================
// 購入ランキング
// ============================================================================

export async function getPurchaseRanking(
  params: PurchaseRankingParams,
): Promise<RankingResponse<PurchaseRankingEntry>> {
  const range = resolveDateRange(params);
  const sortBy = params.sortBy ?? "totalCoinAmount";
  const limit = Math.min(
    Math.max(params.limit ?? DEFAULT_PURCHASE_RANKING_LIMIT, 1),
    MAX_PURCHASE_RANKING_LIMIT,
  );
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const conditions = buildConditions(range.dateFrom, range.dateTo, params);
  const sortAlias = resolveSortAlias(sortBy);

  // ランキングクエリ（users JOIN）+ 総ユーザー数を並列実行
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        userId: p.user_id,
        displayName: u.name,
        totalCoinAmount:
          sql<number>`COALESCE(SUM(${p.amount}), 0)`.as("total_coin_amount"),
        totalPaymentAmount:
          sql<number>`COALESCE(SUM(${p.payment_amount}), 0)`.as(
            "total_payment_amount",
          ),
        purchaseCount: sql<number>`COUNT(*)::int`.as("purchase_count"),
        avgPaymentAmount:
          sql<number>`ROUND(AVG(${p.payment_amount}))::int`.as(
            "avg_payment_amount",
          ),
        lastPurchaseAt:
          sql<string>`MAX(${p.completed_at})::text`.as("last_purchase_at"),
      })
      .from(p)
      .leftJoin(u, eq(p.user_id, u.id))
      .where(and(...conditions))
      .groupBy(p.user_id, u.name)
      .orderBy(sql.raw(`${sortAlias} DESC`))
      .limit(limit)
      .offset(offset),
    db
      .select({
        total: sql<number>`COUNT(DISTINCT ${p.user_id})::int`.as("total"),
      })
      .from(p)
      .where(and(...conditions)),
  ]);
  const totalRow = totalRows[0];

  return {
    items: rows.map((r, idx) => ({
      rank: offset + idx + 1,
      userId: r.userId,
      displayName: r.displayName ?? null,
      totalCoinAmount: Number(r.totalCoinAmount),
      totalPaymentAmount: Number(r.totalPaymentAmount),
      purchaseCount: Number(r.purchaseCount),
      avgPaymentAmount: Number(r.avgPaymentAmount),
      lastPurchaseAt: r.lastPurchaseAt ?? null,
    })),
    total: Number(totalRow!.total),
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** フィルタ条件を構築（status='completed' 固定） */
function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserFilter & { paymentProvider?: string },
): SQL[] {
  const conditions: SQL[] = [
    between(p.completed_at, dateFrom, dateTo),
    eq(p.status, "completed"),
  ];

  // ユーザー属性フィルタ（roles ホワイトリスト + デモユーザー除外）
  conditions.push(...buildUserFilterConditions(p.user_id, params));

  if (params.walletType) {
    conditions.push(
      eq(p.wallet_type, params.walletType as "regular_coin" | "regular_point"),
    );
  }

  if (params.paymentProvider) {
    conditions.push(eq(p.payment_provider, params.paymentProvider));
  }

  return conditions;
}
