// src/features/core/analytics/services/server/referralAnalytics.ts
// referral / referralReward 集計サービス（期間サマリー）。
//
// 設計方針:
//  - 紹介経由で登録した invitee の集計 (referredUserCount) と
//    紹介リワード金額の集計 (rewardTotal) を 1 つの summary API で返す。
//  - referrals.status のフィルタは呼び出し側で指定可能。省略時は全状態をカウント。
//  - rewardTotal の金額抽出 SQL 式は呼び出し側でオーバーライド可能。
//    デフォルトは `(metadata ->> 'amount')::numeric`（rewardHandler が
//    metadata に `amount` を入れる規約に従う場合）。
//    metadata 構造が異なる下流は rewardAmountExpr を渡せば任意の式で集計できる。
//  - 当期+前期を CASE WHEN で 1 クエリにまとめて並列実行する（既存 summary 系と同パターン）。

import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { ReferralTable } from "@/features/core/referral/entities/drizzle";
import { ReferralRewardTable } from "@/features/core/referralReward/entities/drizzle";
import { and, between, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import type {
  DateRangeParams,
  PeriodSummaryResponse,
  ResolvedDateRange,
  UserFilter,
} from "@/features/core/analytics/types/common";
import { resolveDateRange, formatDateRangeForResponse } from "./utils/dateRange";
import { changeRate } from "./utils/aggregation";

// ============================================================================
// 型定義
// ============================================================================

/** referrals.status の取りうる値（drizzle pgEnum と同期） */
export type ReferralStatus = "active" | "cancelled";

export type ReferralSummaryParams = DateRangeParams & UserFilter & {
  /**
   * 集計対象とする紹介ステータスのホワイトリスト。
   * 省略時は全状態 (active + cancelled) をカウント。
   * 「現在も有効な紹介経由ユーザー数」を見たい場合は ["active"] を指定する。
   */
  referralStatuses?: readonly ReferralStatus[];
  /**
   * リワード金額抽出 SQL 式。
   * 省略時は DEFAULT_REWARD_AMOUNT_EXPR を使う。
   * 下流で metadata 構造が異なる場合はカスタム SQL を渡す。
   */
  rewardAmountExpr?: SQL<number>;
};

type ReferralSummaryData = {
  /** 期間内に新規登録した invitee のうち、対象 status の referral を持つユニーク数 */
  referredUserCount: number;
  /** 期間内に fulfilled された referralReward の金額合計 */
  rewardTotal: number;
  comparison: {
    previousPeriod: {
      referredUserCount: number;
      rewardTotal: number;
      changeRate: {
        referredUserCount: number | null;
        rewardTotal: number | null;
      };
    };
  };
};

/**
 * リワード金額抽出のデフォルト SQL 式。
 *
 * `rewardHandler` が `metadata` に `amount: number` を入れる規約に従う。
 * 規約が異なる下流は ReferralSummaryParams.rewardAmountExpr を渡してオーバーライドする。
 */
export const DEFAULT_REWARD_AMOUNT_EXPR: SQL<number> =
  sql<number>`(${ReferralRewardTable.metadata} ->> 'amount')::numeric`;

/**
 * 当期+前期の referralReward 合計を 1 クエリで集計するヘルパー。
 *
 * coinIssuance の referralReward ソースと getReferralSummary の rewardTotal 計算が
 * 同一 SQL を要求するため、共通化して二重メンテを防ぐ。
 *
 * 集計条件は既存 getReferralSummary と完全に同一:
 *   - ReferralRewardTable.fulfilled_at が当期 or 前期に含まれる
 *   - ReferralRewardTable.status = "fulfilled"
 *   - UserFilter は適用しない (既存 referral summary の rewardTotal も非適用のため踏襲)
 *
 * 公開関数として export しているため、coinIssuance/sources/ や下流の独自集計から再利用できる。
 */
export type AggregateReferralRewardCurrentVsPrevParams = {
  range: ResolvedDateRange;
  prevRange: { dateFrom: Date; dateTo: Date };
  /** 金額抽出 SQL 式。省略時は DEFAULT_REWARD_AMOUNT_EXPR */
  rewardAmountExpr?: SQL<number>;
};

export async function aggregateReferralRewardCurrentVsPrev(
  params: AggregateReferralRewardCurrentVsPrevParams,
): Promise<{ current: number; previous: number }> {
  const amountExpr = params.rewardAmountExpr ?? DEFAULT_REWARD_AMOUNT_EXPR;

  const isCurrentReward = sql`(${ReferralRewardTable.fulfilled_at} >= ${params.range.dateFrom.toISOString()} AND ${ReferralRewardTable.fulfilled_at} <= ${params.range.dateTo.toISOString()})`;
  const isPrevReward = sql`(${ReferralRewardTable.fulfilled_at} >= ${params.prevRange.dateFrom.toISOString()} AND ${ReferralRewardTable.fulfilled_at} <= ${params.prevRange.dateTo.toISOString()})`;

  const rows = await db
    .select({
      current: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrentReward} THEN ${amountExpr} ELSE 0 END), 0)::numeric`.as("current_total"),
      previous: sql<number>`COALESCE(SUM(CASE WHEN ${isPrevReward} THEN ${amountExpr} ELSE 0 END), 0)::numeric`.as("prev_total"),
    })
    .from(ReferralRewardTable)
    .where(and(
      between(ReferralRewardTable.fulfilled_at, params.prevRange.dateFrom, params.range.dateTo),
      eq(ReferralRewardTable.status, "fulfilled"),
    ));

  return {
    current: Number(rows[0]?.current ?? 0),
    previous: Number(rows[0]?.previous ?? 0),
  };
}

// ============================================================================
// テーブル別名
// ============================================================================

const u = UserTable;
const r = ReferralTable;
const rr = ReferralRewardTable;

// ============================================================================
// サマリー集計
// ============================================================================

export async function getReferralSummary(
  params: ReferralSummaryParams,
): Promise<PeriodSummaryResponse<ReferralSummaryData>> {
  const range = resolveDateRange(params);
  const statuses = params.referralStatuses;

  // 前期の日付範囲（既存 summary 系と同パターン）
  const prevDateFrom = new Date(range.dateFrom);
  prevDateFrom.setDate(prevDateFrom.getDate() - range.dayCount);
  const prevDateTo = new Date(range.dateFrom);
  prevDateTo.setMilliseconds(prevDateTo.getMilliseconds() - 1);
  const prevRange = { dateFrom: prevDateFrom, dateTo: prevDateTo };

  const isCurrentUser = sql`(${u.createdAt} >= ${range.dateFrom.toISOString()} AND ${u.createdAt} <= ${range.dateTo.toISOString()})`;
  const isPrevUser = sql`(${u.createdAt} >= ${prevDateFrom.toISOString()} AND ${u.createdAt} <= ${prevDateTo.toISOString()})`;

  const userTableFilters = buildUserTableFilterConditions(params);
  const statusFilter = statuses && statuses.length > 0
    ? [inArray(r.status, statuses as readonly ReferralStatus[] as [ReferralStatus, ...ReferralStatus[]])]
    : [];

  // referredUserCount: User × Referral inner join、当期+前期を 1 クエリで集計
  const referredRowsPromise = db
    .select({
      current: sql<number>`COUNT(DISTINCT CASE WHEN ${isCurrentUser} THEN ${u.id} END)::int`.as("current_count"),
      previous: sql<number>`COUNT(DISTINCT CASE WHEN ${isPrevUser} THEN ${u.id} END)::int`.as("prev_count"),
    })
    .from(u)
    .innerJoin(r, eq(r.invitee_user_id, u.id))
    .where(and(
      between(u.createdAt, prevDateFrom, range.dateTo),
      isNull(u.deletedAt),
      ...userTableFilters,
      ...statusFilter,
    ));

  // rewardTotal: 共通ヘルパーで当期+前期を 1 クエリ集計 (coinIssuance と同一ロジック)
  const rewardTotalsPromise = aggregateReferralRewardCurrentVsPrev({
    range,
    prevRange,
    rewardAmountExpr: params.rewardAmountExpr,
  });

  const [referredRows, rewardTotals] = await Promise.all([referredRowsPromise, rewardTotalsPromise]);

  const referredUserCount = Number(referredRows[0]?.current ?? 0);
  const prevReferredUserCount = Number(referredRows[0]?.previous ?? 0);
  const rewardTotal = rewardTotals.current;
  const prevRewardTotal = rewardTotals.previous;

  return {
    ...formatDateRangeForResponse(range),
    referredUserCount,
    rewardTotal,
    comparison: {
      previousPeriod: {
        referredUserCount: prevReferredUserCount,
        rewardTotal: prevRewardTotal,
        changeRate: {
          referredUserCount: changeRate(referredUserCount, prevReferredUserCount),
          rewardTotal: changeRate(rewardTotal, prevRewardTotal),
        },
      },
    },
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** UserTable 直接フィルタ（userAnalytics と同じ実装パターン） */
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
