// src/features/core/analytics/services/server/purchaseRegistrationAgeAnalytics.ts
// 購入ユーザーの登録経過日数分布集計サービス
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
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

/** 登録経過日数グループ */
type RegistrationAgeGroup = {
  /** グループの下限日数 */
  minDays: number;
  /** グループの上限日数（最上位グループは null） */
  maxDays: number | null;
  /** グループ内のユーザー数 */
  userCount: number;
  /** グループ内の合計購入額（coin_amount） */
  totalAmount: number;
  /** ユーザー数の割合（%） */
  percentage: number;
  /** 金額の割合（%） */
  amountPercentage: number;
};

type RegistrationAgeData = {
  totalUsers: number;
  totalAmount: number;
  groups: RegistrationAgeGroup[];
};

type RegistrationAgeResponse = {
  dateFrom: string;
  dateTo: string;
} & RegistrationAgeData;

export type RegistrationAgeParams = DateRangeParams &
  WalletTypeFilter &
  UserFilter & {
    boundaries: number[];
  };

// ============================================================================
// バリデーション
// ============================================================================

/**
 * boundaries パラメータをパースしてバリデーションする（日数用）
 * @returns パース済み境界値配列、不正な場合は null
 */
export function parseDayBoundaries(raw: string): number[] | null {
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

// ============================================================================
// 登録経過日数分布
// ============================================================================

const p = PurchaseRequestTable;
const u = UserTable;

export async function getRegistrationAgeDistribution(
  params: RegistrationAgeParams,
): Promise<RegistrationAgeResponse> {
  const range = resolveDateRange(params);
  const { boundaries } = params;

  const purchaseConditions = buildPurchaseConditions(
    range.dateFrom,
    range.dateTo,
    params,
  );

  // ユーザーごとの合計購入額 + 登録経過日数をサブクエリで算出
  // 登録経過日数 = dateTo - users.created_at（日単位）
  const userAgeSq = db
    .select({
      userId: p.user_id,
      totalAmount:
        sql<number>`COALESCE(SUM(${p.amount}), 0)`.as("total_amount"),
      ageDays:
        sql<number>`FLOOR(EXTRACT(EPOCH FROM (${range.dateTo}::timestamptz - ${u.createdAt})) / 86400)::int`.as(
          "age_days",
        ),
    })
    .from(p)
    .innerJoin(u, eq(p.user_id, u.id))
    .where(and(...purchaseConditions))
    .groupBy(p.user_id, u.createdAt)
    .as("user_age");

  // 動的バケット振り分け式（日数ベース）
  const bucketExpr = buildDayBucketExpr(userAgeSq.ageDays, boundaries);

  // 単一クエリで全バケットを集計
  const rows = await db
    .select({
      bucketMin: bucketExpr.as("bucket_min"),
      userCount: sql<number>`COUNT(*)::int`.as("user_count"),
      totalAmount:
        sql<number>`COALESCE(SUM(${userAgeSq.totalAmount}), 0)`.as(
          "group_total",
        ),
    })
    .from(userAgeSq)
    .groupBy(sql`bucket_min`)
    .orderBy(sql`bucket_min ASC`);

  // 全体の合計をJS側で算出
  const totalUsers = rows.reduce((sum, r) => sum + Number(r.userCount), 0);
  const totalAmount = rows.reduce((sum, r) => sum + Number(r.totalAmount), 0);

  // 全バケットを構築（データなしバケットも含む）
  const allBucketMins = [0, ...boundaries];
  const resultMap = new Map(rows.map((r) => [Number(r.bucketMin), r]));

  const groups: RegistrationAgeGroup[] = allBucketMins.map((min, idx) => {
    const maxDays =
      idx < allBucketMins.length - 1 ? allBucketMins[idx + 1] - 1 : null;
    const row = resultMap.get(min);
    const userCount = row ? Number(row.userCount) : 0;
    const groupAmount = row ? Number(row.totalAmount) : 0;

    return {
      minDays: min,
      maxDays,
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
    totalUsers,
    totalAmount,
    groups,
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/**
 * CASE WHEN式で登録経過日数をバケットに振り分ける
 * boundaries を降順に評価し、最初に一致した境界値を返す（最下位は 0）
 */
function buildDayBucketExpr(
  ageDaysRef: SQL.Aliased<number>,
  boundaries: number[],
): SQL {
  const desc = [...boundaries].sort((a, b) => b - a);
  const whenClauses = desc.map(
    (b) => sql`WHEN ${ageDaysRef} >= ${b} THEN ${b}`,
  );
  return sql`CASE ${sql.join(whenClauses, sql` `)} ELSE 0 END`;
}

/** 購入テーブルのフィルタ条件を構築（status='completed' 固定） */
function buildPurchaseConditions(
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
