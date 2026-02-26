// src/features/core/analytics/services/server/purchaseAnalytics.ts
// purchase 集計サービス（日別売上 + 期間サマリー + ステータス概況）

import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { and, between, eq, type SQL } from "drizzle-orm";
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
import { groupByDate, countUnique, groupBy, sum, median, changeRate } from "./utils/aggregation";

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
// DB型
// ============================================================================

type PurchaseRow = typeof PurchaseRequestTable.$inferSelect;

// ============================================================================
// 日別売上集計
// ============================================================================

export async function getPurchaseDaily(
  params: PurchaseDailyParams,
): Promise<DailyAnalyticsResponse<PurchaseDailyData>> {
  const range = resolveDateRange(params);
  const status = params.status ?? "completed";

  const conditions = buildConditions(range.dateFrom, range.dateTo, {
    ...params,
    status,
  });
  const records = await db
    .select()
    .from(PurchaseRequestTable)
    .where(and(...conditions));

  const grouped = groupByDate(records, (r) => r.completed_at ?? r.paid_at, range.timezone);
  const dateKeys = generateDateKeys(range);

  const history = dateKeys.map((date) => {
    const dayRecords = grouped.get(date) ?? [];
    return {
      date,
      ...aggregatePurchaseDailyRecords(dayRecords),
    };
  });

  return {
    ...formatDateRangeForResponse(range),
    history,
  };
}

// ============================================================================
// 期間売上サマリー
// ============================================================================

export async function getPurchaseSummary(
  params: PurchaseSummaryParams,
): Promise<PeriodSummaryResponse<PurchaseSummaryData>> {
  const range = resolveDateRange(params);

  // 当期のデータ取得
  const conditions = buildConditions(range.dateFrom, range.dateTo, {
    ...params,
    status: "completed",
  });
  const records = await db
    .select()
    .from(PurchaseRequestTable)
    .where(and(...conditions));

  // 前期のデータ取得（比較用）
  const prevDateFrom = new Date(range.dateFrom);
  prevDateFrom.setDate(prevDateFrom.getDate() - range.dayCount);
  const prevDateTo = new Date(range.dateFrom);
  prevDateTo.setMilliseconds(prevDateTo.getMilliseconds() - 1);

  const prevConditions = buildConditions(prevDateFrom, prevDateTo, {
    ...params,
    status: "completed",
  });
  const prevRecords = await db
    .select()
    .from(PurchaseRequestTable)
    .where(and(...prevConditions));

  // 当期集計
  const paymentAmounts = records.map((r) => r.payment_amount);
  const totalPaymentAmount = sum(paymentAmounts);
  const totalCoinAmount = sum(records.map((r) => r.amount));
  const totalDiscountAmount = sum(records.map((r) => r.discount_amount ?? 0));

  // リピート率: 2回以上購入したユーザー / 全購入ユーザー
  const userPurchaseCounts = new Map<string, number>();
  for (const r of records) {
    userPurchaseCounts.set(r.user_id, (userPurchaseCounts.get(r.user_id) ?? 0) + 1);
  }
  const totalPurchasers = userPurchaseCounts.size;
  const repeatPurchasers = Array.from(userPurchaseCounts.values()).filter((c) => c >= 2).length;

  // プロバイダ別
  const byProviderGrouped = groupBy(records, (r) => r.payment_provider ?? "unknown");
  const byProvider: Record<string, ProviderSummary> = {};
  for (const [provider, providerRecords] of byProviderGrouped) {
    byProvider[provider] = {
      paymentAmount: sum(providerRecords.map((r) => r.payment_amount)),
      count: providerRecords.length,
    };
  }

  // ウォレット種別
  const byWalletType = buildWalletTypeSummary(records);

  // 前期集計
  const prevTotalPaymentAmount = sum(prevRecords.map((r) => r.payment_amount));
  const prevPurchaseCount = prevRecords.length;

  return {
    ...formatDateRangeForResponse(range),
    totalCoinAmount,
    totalPaymentAmount,
    totalDiscountAmount,
    purchaseCount: records.length,
    uniqueUsers: totalPurchasers,
    avgPaymentAmount: records.length > 0 ? Math.round(totalPaymentAmount / records.length) : 0,
    medianPaymentAmount: median(paymentAmounts),
    maxPaymentAmount: paymentAmounts.length > 0 ? Math.max(...paymentAmounts) : 0,
    repeatPurchaseRate: totalPurchasers > 0 ? repeatPurchasers / totalPurchasers : 0,
    byProvider,
    byWalletType,
    comparison: {
      previousPeriod: {
        totalPaymentAmount: prevTotalPaymentAmount,
        purchaseCount: prevPurchaseCount,
        changeRate: {
          paymentAmount: changeRate(totalPaymentAmount, prevTotalPaymentAmount),
          count: changeRate(records.length, prevPurchaseCount),
        },
      },
    },
  };
}

// ============================================================================
// ステータス概況
// ============================================================================

export async function getPurchaseStatusOverview(): Promise<StatusOverviewData> {
  // 全ステータスのレコードを取得（直近のみで良い場合はフィルタ追加可能）
  const records = await db
    .select()
    .from(PurchaseRequestTable);

  const statuses = ["pending", "processing", "completed", "failed", "expired"] as const;
  const current: Record<string, StatusCount> = {};

  for (const status of statuses) {
    const statusRecords = records.filter((r) => r.status === status);
    const amounts = statusRecords.map((r) => r.amount);
    const dates = statusRecords
      .map((r) => r.createdAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    current[status] = {
      count: statusRecords.length,
      totalAmount: sum(amounts),
      oldestAt: dates.length > 0 ? dates[0]!.toISOString() : null,
    };
  }

  // 失敗理由の集計
  const failedRecords = records.filter((r) => r.status === "failed");
  const errorCounts = new Map<string, number>();
  for (const r of failedRecords) {
    const code = r.error_code ?? "unknown";
    errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
  }

  const failureReasons: FailureReason[] = Array.from(errorCounts.entries())
    .map(([errorCode, count]) => ({ errorCode, count }))
    .sort((a, b) => b.count - a.count);

  return { current, failureReasons };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserIdFilter & UserFilter & { paymentProvider?: string; status?: string },
): SQL[] {
  const dateColumn = params.status === "completed"
    ? PurchaseRequestTable.completed_at
    : PurchaseRequestTable.createdAt;

  const conditions: SQL[] = [
    between(dateColumn, dateFrom, dateTo),
  ];

  if (params.userId) {
    conditions.push(eq(PurchaseRequestTable.user_id, params.userId));
  }

  // ユーザー属性フィルタ（roles ホワイトリスト + デモユーザー除外）
  conditions.push(...buildUserFilterConditions(PurchaseRequestTable.user_id, params));

  if (params.status) {
    conditions.push(eq(PurchaseRequestTable.status, params.status as "completed"));
  }

  if (params.walletType) {
    conditions.push(eq(PurchaseRequestTable.wallet_type, params.walletType as "regular_coin" | "regular_point"));
  }

  if (params.paymentProvider) {
    conditions.push(eq(PurchaseRequestTable.payment_provider, params.paymentProvider));
  }

  return conditions;
}

function aggregatePurchaseDailyRecords(records: PurchaseRow[]): Omit<PurchaseDailyData, "date"> {
  const paymentAmounts = records.map((r) => r.payment_amount);
  const totalPayment = sum(paymentAmounts);

  return {
    coinAmount: sum(records.map((r) => r.amount)),
    paymentAmount: totalPayment,
    discountAmount: sum(records.map((r) => r.discount_amount ?? 0)),
    purchaseCount: records.length,
    uniqueUsers: countUnique(records, (r) => r.user_id),
    avgPaymentAmount: records.length > 0 ? Math.round(totalPayment / records.length) : 0,
    byWalletType: buildWalletTypeSummary(records),
  };
}

function buildWalletTypeSummary(records: PurchaseRow[]): Record<string, WalletTypeSummary> {
  const grouped = groupBy(records, (r) => r.wallet_type);
  const result: Record<string, WalletTypeSummary> = {};

  for (const [walletType, typeRecords] of grouped) {
    result[walletType] = {
      coinAmount: sum(typeRecords.map((r) => r.amount)),
      paymentAmount: sum(typeRecords.map((r) => r.payment_amount)),
      count: typeRecords.length,
    };
  }

  return result;
}
