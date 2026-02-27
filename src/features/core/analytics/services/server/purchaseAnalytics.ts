// src/features/core/analytics/services/server/purchaseAnalytics.ts
// purchase 集計サービス（日別売上 + 期間サマリー + ステータス概況）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { and, between, eq, sql, type SQL } from "drizzle-orm";
import type {
  DateRangeParams,
  DailyAnalyticsResponse,
  PeriodSummaryResponse,
  WalletTypeFilter,
  UserIdFilter,
  UserFilter,
} from "@/features/core/analytics/types/common";
import { buildUserFilterConditions } from "./utils/userFilter";
import {
  resolveDateRange,
  generateDateKeys,
  formatDateRangeForResponse,
} from "./utils/dateRange";
import { changeRate } from "./utils/aggregation";

// ============================================================================
// 型定義
// ============================================================================

type WalletTypeSummary = {
  coinAmount: number;
  paymentAmount: number;
  count: number;
};

type PurchaseDailyData = {
  coinAmount: number;
  paymentAmount: number;
  discountAmount: number;
  purchaseCount: number;
  uniqueUsers: number;
  avgPaymentAmount: number;
  byWalletType: Record<string, WalletTypeSummary>;
};

type ProviderSummary = {
  paymentAmount: number;
  count: number;
};

type PurchaseSummaryData = {
  totalCoinAmount: number;
  totalPaymentAmount: number;
  totalDiscountAmount: number;
  purchaseCount: number;
  uniqueUsers: number;
  avgPaymentAmount: number;
  medianPaymentAmount: number;
  maxPaymentAmount: number;
  repeatPurchaseRate: number;
  byProvider: Record<string, ProviderSummary>;
  byWalletType: Record<string, WalletTypeSummary>;
  comparison: {
    previousPeriod: {
      totalPaymentAmount: number;
      purchaseCount: number;
      changeRate: {
        paymentAmount: number | null;
        count: number | null;
      };
    };
  };
};

type StatusCount = {
  count: number;
  totalAmount: number;
  oldestAt: string | null;
};

type FailureReason = {
  errorCode: string;
  count: number;
};

type StatusOverviewData = {
  current: Record<string, StatusCount>;
  failureReasons: FailureReason[];
};

export type PurchaseDailyParams = DateRangeParams & WalletTypeFilter & UserIdFilter & UserFilter & {
  paymentProvider?: string;
  status?: string;
};

export type PurchaseSummaryParams = DateRangeParams & WalletTypeFilter & UserIdFilter & UserFilter;

// ============================================================================
// SQL式ヘルパー
// ============================================================================

const p = PurchaseRequestTable;

/** グルーピング用日付式（completed_at優先、fallbackでpaid_at） */
function purchaseDateExpr(tz: string) {
  return sql<string>`DATE(COALESCE(${p.completed_at}, ${p.paid_at}) AT TIME ZONE ${tz})::text`;
}

// ============================================================================
// 日別売上集計
// ============================================================================

export async function getPurchaseDaily(
  params: PurchaseDailyParams,
): Promise<DailyAnalyticsResponse<PurchaseDailyData>> {
  const range = resolveDateRange(params);
  const tz = range.timezone;
  const status = params.status ?? "completed";

  const conditions = buildConditions(range.dateFrom, range.dateTo, { ...params, status });
  const dateSql = purchaseDateExpr(tz);

  // メインクエリ + ウォレット種別ブレイクダウンを並列実行
  const [dailyRows, walletTypeRows] = await Promise.all([
    db
      .select({
        date: dateSql,
        coinAmount: sql<number>`COALESCE(SUM(${p.amount}), 0)`.as("coin_amount"),
        paymentAmount: sql<number>`COALESCE(SUM(${p.payment_amount}), 0)`.as("payment_amount"),
        discountAmount: sql<number>`COALESCE(SUM(COALESCE(${p.discount_amount}, 0)), 0)`.as("discount_amount"),
        purchaseCount: sql<number>`COUNT(*)::int`.as("purchase_count"),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${p.user_id})::int`.as("unique_users"),
      })
      .from(p)
      .where(and(...conditions))
      .groupBy(sql.raw("1")),
    db
      .select({
        date: dateSql,
        walletType: sql<string>`${p.wallet_type}`.as("wallet_type"),
        coinAmount: sql<number>`COALESCE(SUM(${p.amount}), 0)`.as("coin_amount"),
        paymentAmount: sql<number>`COALESCE(SUM(${p.payment_amount}), 0)`.as("payment_amount"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(p)
      .where(and(...conditions))
      .groupBy(sql.raw("1"), p.wallet_type),
  ]);

  // Map化
  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));
  const walletTypeMap = new Map<string, Record<string, WalletTypeSummary>>();
  for (const r of walletTypeRows) {
    if (!walletTypeMap.has(r.date)) walletTypeMap.set(r.date, {});
    walletTypeMap.get(r.date)![r.walletType] = {
      coinAmount: Number(r.coinAmount),
      paymentAmount: Number(r.paymentAmount),
      count: Number(r.count),
    };
  }

  // データなし日を埋めてレスポンス構築
  const dateKeys = generateDateKeys(range);
  const emptyDay: PurchaseDailyData = {
    coinAmount: 0, paymentAmount: 0, discountAmount: 0,
    purchaseCount: 0, uniqueUsers: 0, avgPaymentAmount: 0, byWalletType: {},
  };

  const history = dateKeys.map((date) => {
    const row = dailyMap.get(date);
    if (!row) return { date, ...emptyDay };
    const paymentAmount = Number(row.paymentAmount);
    const purchaseCount = Number(row.purchaseCount);
    return {
      date,
      coinAmount: Number(row.coinAmount),
      paymentAmount,
      discountAmount: Number(row.discountAmount),
      purchaseCount,
      uniqueUsers: Number(row.uniqueUsers),
      avgPaymentAmount: purchaseCount > 0 ? Math.round(paymentAmount / purchaseCount) : 0,
      byWalletType: walletTypeMap.get(date) ?? {},
    };
  });

  return { ...formatDateRangeForResponse(range), history };
}

// ============================================================================
// 期間売上サマリー
// ============================================================================

export async function getPurchaseSummary(
  params: PurchaseSummaryParams,
): Promise<PeriodSummaryResponse<PurchaseSummaryData>> {
  const range = resolveDateRange(params);

  const statusParams = { ...params, status: "completed" as const };
  const conditions = buildConditions(range.dateFrom, range.dateTo, statusParams);

  // 前期の日付範囲
  const prevDateFrom = new Date(range.dateFrom);
  prevDateFrom.setDate(prevDateFrom.getDate() - range.dayCount);
  const prevDateTo = new Date(range.dateFrom);
  prevDateTo.setMilliseconds(prevDateTo.getMilliseconds() - 1);

  // 当期+前期を1クエリで集計するための条件（CASE WHENで期間を分離）
  const unifiedConditions: SQL[] = [
    between(p.completed_at, prevDateFrom, range.dateTo),
    ...buildNonDateConditions(statusParams),
  ];
  const isCurrent = sql`(${p.completed_at} >= ${range.dateFrom} AND ${p.completed_at} <= ${range.dateTo})`;
  const isPrev = sql`(${p.completed_at} >= ${prevDateFrom} AND ${p.completed_at} <= ${prevDateTo})`;

  // 4クエリを並列実行（メイン集計+前期比較を統合）
  const [summaryRows, repeatDataRows, providerRows, walletTypeRows] = await Promise.all([
    // 1. メイン集計 + 前期比較（CASE WHENで1クエリ化）
    db
      .select({
        totalCoinAmount: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrent} THEN ${p.amount} ELSE 0 END), 0)`.as("total_coin"),
        totalPaymentAmount: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrent} THEN ${p.payment_amount} ELSE 0 END), 0)`.as("total_payment"),
        totalDiscountAmount: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrent} THEN COALESCE(${p.discount_amount}, 0) ELSE 0 END), 0)`.as("total_discount"),
        purchaseCount: sql<number>`SUM(CASE WHEN ${isCurrent} THEN 1 ELSE 0 END)::int`.as("purchase_count"),
        uniqueUsers: sql<number>`COUNT(DISTINCT CASE WHEN ${isCurrent} THEN ${p.user_id} END)::int`.as("unique_users"),
        maxPaymentAmount: sql<number>`COALESCE(MAX(CASE WHEN ${isCurrent} THEN ${p.payment_amount} END), 0)`.as("max_payment"),
        medianPaymentAmount: sql<number>`COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN ${isCurrent} THEN ${p.payment_amount} END), 0)`.as("median_payment"),
        // 前期比較
        prevPaymentAmount: sql<number>`COALESCE(SUM(CASE WHEN ${isPrev} THEN ${p.payment_amount} ELSE 0 END), 0)`.as("prev_payment"),
        prevCount: sql<number>`SUM(CASE WHEN ${isPrev} THEN 1 ELSE 0 END)::int`.as("prev_count"),
      })
      .from(p)
      .where(and(...unifiedConditions)),
    // 2. リピート率（2回以上購入ユーザー数）
    db
      .select({
        repeatUsers: sql<number>`COUNT(*)::int`.as("repeat_users"),
      })
      .from(
        db
          .select({ user_id: p.user_id })
          .from(p)
          .where(and(...conditions))
          .groupBy(p.user_id)
          .having(sql`COUNT(*) >= 2`)
          .as("repeat_sub"),
      ),
    // 3. プロバイダ別
    db
      .select({
        provider: sql<string>`COALESCE(${p.payment_provider}, 'unknown')`.as("provider"),
        paymentAmount: sql<number>`COALESCE(SUM(${p.payment_amount}), 0)`.as("payment_amount"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(p)
      .where(and(...conditions))
      .groupBy(p.payment_provider),
    // 4. ウォレット種別
    db
      .select({
        walletType: sql<string>`${p.wallet_type}`.as("wallet_type"),
        coinAmount: sql<number>`COALESCE(SUM(${p.amount}), 0)`.as("coin_amount"),
        paymentAmount: sql<number>`COALESCE(SUM(${p.payment_amount}), 0)`.as("payment_amount"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(p)
      .where(and(...conditions))
      .groupBy(p.wallet_type),
  ]);

  const summary = summaryRows[0];
  const repeatData = repeatDataRows[0];

  // 結果構築
  const byProvider: Record<string, ProviderSummary> = {};
  for (const r of providerRows) {
    byProvider[r.provider] = {
      paymentAmount: Number(r.paymentAmount),
      count: Number(r.count),
    };
  }

  const byWalletType: Record<string, WalletTypeSummary> = {};
  for (const r of walletTypeRows) {
    byWalletType[r.walletType] = {
      coinAmount: Number(r.coinAmount),
      paymentAmount: Number(r.paymentAmount),
      count: Number(r.count),
    };
  }

  const totalPaymentAmount = Number(summary!.totalPaymentAmount);
  const purchaseCount = Number(summary!.purchaseCount);
  const uniqueUsers = Number(summary!.uniqueUsers);
  const prevTotalPaymentAmount = Number(summary!.prevPaymentAmount);
  const prevPurchaseCount = Number(summary!.prevCount);

  return {
    ...formatDateRangeForResponse(range),
    totalCoinAmount: Number(summary!.totalCoinAmount),
    totalPaymentAmount,
    totalDiscountAmount: Number(summary!.totalDiscountAmount),
    purchaseCount,
    uniqueUsers,
    avgPaymentAmount: purchaseCount > 0 ? Math.round(totalPaymentAmount / purchaseCount) : 0,
    medianPaymentAmount: Number(summary!.medianPaymentAmount),
    maxPaymentAmount: Number(summary!.maxPaymentAmount),
    repeatPurchaseRate: uniqueUsers > 0 ? Number(repeatData!.repeatUsers) / uniqueUsers : 0,
    byProvider,
    byWalletType,
    comparison: {
      previousPeriod: {
        totalPaymentAmount: prevTotalPaymentAmount,
        purchaseCount: prevPurchaseCount,
        changeRate: {
          paymentAmount: changeRate(totalPaymentAmount, prevTotalPaymentAmount),
          count: changeRate(purchaseCount, prevPurchaseCount),
        },
      },
    },
  };
}

// ============================================================================
// ステータス概況
// ============================================================================

export async function getPurchaseStatusOverview(): Promise<StatusOverviewData> {
  // ステータス別集計 + 失敗理由を並列実行
  const [statusRows, failureRows] = await Promise.all([
    db
      .select({
        status: sql<string>`${p.status}`.as("status"),
        count: sql<number>`COUNT(*)::int`.as("count"),
        totalAmount: sql<number>`COALESCE(SUM(${p.amount}), 0)`.as("total_amount"),
        oldestAt: sql<string>`MIN(${p.createdAt})::text`.as("oldest_at"),
      })
      .from(p)
      .groupBy(p.status),
    db
      .select({
        errorCode: sql<string>`COALESCE(${p.error_code}, 'unknown')`.as("error_code"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(p)
      .where(eq(p.status, "failed"))
      .groupBy(p.error_code)
      .orderBy(sql`COUNT(*) DESC`),
  ]);

  // 結果構築
  const statuses = ["pending", "processing", "completed", "failed", "expired"] as const;
  const current: Record<string, StatusCount> = {};
  const statusMap = new Map(statusRows.map((r) => [r.status, r]));

  for (const status of statuses) {
    const row = statusMap.get(status);
    current[status] = {
      count: row ? Number(row.count) : 0,
      totalAmount: row ? Number(row.totalAmount) : 0,
      oldestAt: row?.oldestAt ?? null,
    };
  }

  const failureReasons: FailureReason[] = failureRows.map((r) => ({
    errorCode: r.errorCode,
    count: Number(r.count),
  }));

  return { current, failureReasons };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** 日付以外のフィルタ条件 */
function buildNonDateConditions(
  params: WalletTypeFilter & UserIdFilter & UserFilter & { paymentProvider?: string; status?: string },
): SQL[] {
  const conditions: SQL[] = [];

  if (params.userId) {
    conditions.push(eq(p.user_id, params.userId));
  }

  conditions.push(...buildUserFilterConditions(p.user_id, params));

  if (params.status) {
    conditions.push(eq(p.status, params.status as "completed"));
  }

  if (params.walletType) {
    conditions.push(eq(p.wallet_type, params.walletType as "regular_coin" | "regular_point"));
  }

  if (params.paymentProvider) {
    conditions.push(eq(p.payment_provider, params.paymentProvider));
  }

  return conditions;
}

/** 日付範囲 + 全フィルタの条件 */
function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserIdFilter & UserFilter & { paymentProvider?: string; status?: string },
): SQL[] {
  const dateColumn = params.status === "completed"
    ? p.completed_at
    : p.createdAt;

  return [
    between(dateColumn, dateFrom, dateTo),
    ...buildNonDateConditions(params),
  ];
}
