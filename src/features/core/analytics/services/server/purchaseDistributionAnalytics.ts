// src/features/core/analytics/services/server/purchaseDistributionAnalytics.ts
// 購入額グループ分布集計サービス
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { and, between, eq, sql, type SQL } from "drizzle-orm";
import type {
  DateRangeParams,
  WalletTypeFilter,
  UserFilter,
} from "@/features/core/analytics/types/common";
import { MAX_DISTRIBUTION_BOUNDARIES } from "@/features/core/analytics/constants";
import { buildUserFilterConditions } from "./utils/userFilter";
import {
  resolveDateRange,
  formatDateRangeForResponse,
} from "./utils/dateRange";

// ============================================================================
// 型定義
// ============================================================================

/** 分布集計の指標 */
export type DistributionMetric = "coinAmount" | "paymentAmount";

/** グループ分布のレスポンス */
type DistributionGroup = {
  /** グループの下限値 */
  min: number;
  /** グループの上限値（最上位グループは null） */
  max: number | null;
  /** グループ内のユーザー数 */
  userCount: number;
  /** グループ内の合計額 */
  totalAmount: number;
  /** ユーザー数の割合（%） */
  percentage: number;
  /** 金額の割合（%） */
  amountPercentage: number;
};

type PurchaseDistributionData = {
  metric: DistributionMetric;
  totalUsers: number;
  totalAmount: number;
  groups: DistributionGroup[];
};

type PurchaseDistributionResponse = {
  dateFrom: string;
  dateTo: string;
} & PurchaseDistributionData;

export type PurchaseDistributionParams = DateRangeParams &
  WalletTypeFilter &
  UserFilter & {
    boundaries: number[];
    metric?: DistributionMetric;
  };

// ============================================================================
// バリデーション
// ============================================================================

const VALID_METRICS: DistributionMetric[] = ["coinAmount", "paymentAmount"];

/**
 * boundaries パラメータをパースしてバリデーションする
 * @returns パース済み境界値配列、不正な場合は null
 */
export function parseBoundaries(raw: string): number[] | null {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > MAX_DISTRIBUTION_BOUNDARIES)
    return null;

  const numbers = parts.map(Number);

  // 全て正の整数であること
  if (numbers.some((n) => !Number.isFinite(n) || n <= 0 || !Number.isInteger(n)))
    return null;

  // 昇順かつ重複なし
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] <= numbers[i - 1]) return null;
  }

  return numbers;
}

export function parseMetric(raw: string | null): DistributionMetric | undefined {
  if (raw && VALID_METRICS.includes(raw as DistributionMetric)) {
    return raw as DistributionMetric;
  }
  return undefined;
}

// ============================================================================
// 購入額グループ分布
// ============================================================================

const p = PurchaseRequestTable;

export async function getPurchaseDistribution(
  params: PurchaseDistributionParams,
): Promise<PurchaseDistributionResponse> {
  const range = resolveDateRange(params);
  const metric = params.metric ?? "coinAmount";
  const { boundaries } = params;

  const conditions = buildConditions(range.dateFrom, range.dateTo, params);
  const metricColumn = metric === "paymentAmount" ? p.payment_amount : p.amount;

  // ユーザーごとの合計をサブクエリで算出
  const userTotalsSq = db
    .select({
      userId: p.user_id,
      totalAmount:
        sql<number>`COALESCE(SUM(${metricColumn}), 0)`.as("total_amount"),
    })
    .from(p)
    .where(and(...conditions))
    .groupBy(p.user_id)
    .as("user_totals");

  // 動的バケット振り分け式
  const bucketExpr = buildBucketExpr(userTotalsSq.totalAmount, boundaries);

  // 単一クエリで全バケットを集計
  const rows = await db
    .select({
      bucketMin: bucketExpr.as("bucket_min"),
      userCount: sql<number>`COUNT(*)::int`.as("user_count"),
      totalAmount:
        sql<number>`COALESCE(SUM(${userTotalsSq.totalAmount}), 0)`.as(
          "group_total",
        ),
    })
    .from(userTotalsSq)
    .groupBy(sql`bucket_min`)
    .orderBy(sql`bucket_min ASC`);

  // 全体の合計をJS側で算出（全バケットの合算 = 全体）
  const totalUsers = rows.reduce((sum, r) => sum + Number(r.userCount), 0);
  const totalAmount = rows.reduce((sum, r) => sum + Number(r.totalAmount), 0);

  // 全バケットを構築（データなしバケットも含む）
  const allBucketMins = [0, ...boundaries];
  const resultMap = new Map(rows.map((r) => [Number(r.bucketMin), r]));

  const groups: DistributionGroup[] = allBucketMins.map((min, idx) => {
    const max =
      idx < allBucketMins.length - 1 ? allBucketMins[idx + 1] - 1 : null;
    const row = resultMap.get(min);
    const userCount = row ? Number(row.userCount) : 0;
    const groupAmount = row ? Number(row.totalAmount) : 0;

    return {
      min,
      max,
      userCount,
      totalAmount: groupAmount,
      percentage:
        totalUsers > 0
          ? Math.round((userCount / totalUsers) * 10000) / 100
          : 0,
      amountPercentage:
        totalAmount > 0
          ? Math.round((groupAmount / totalAmount) * 10000) / 100
          : 0,
    };
  });

  return {
    ...formatDateRangeForResponse(range),
    metric,
    totalUsers,
    totalAmount,
    groups,
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/**
 * CASE WHEN式でユーザー合計額をバケットに振り分ける
 * boundaries を降順に評価し、最初に一致した境界値を返す（最下位は 0）
 */
function buildBucketExpr(
  metricRef: SQL.Aliased<number>,
  boundaries: number[],
): SQL {
  const desc = [...boundaries].sort((a, b) => b - a);
  const whenClauses = desc.map(
    (b) => sql`WHEN ${metricRef} >= ${b} THEN ${b}`,
  );
  return sql`CASE ${sql.join(whenClauses, sql` `)} ELSE 0 END`;
}

/** フィルタ条件を構築（status='completed' 固定） */
function buildConditions(
  dateFrom: Date,
  dateTo: Date,
  params: WalletTypeFilter & UserFilter,
): SQL[] {
  const conditions: SQL[] = [
    between(p.completed_at, dateFrom, dateTo),
    eq(p.status, "completed"),
  ];

  conditions.push(...buildUserFilterConditions(p.user_id, params));

  if (params.walletType) {
    conditions.push(
      eq(p.wallet_type, params.walletType as "regular_coin" | "regular_point"),
    );
  }

  return conditions;
}
