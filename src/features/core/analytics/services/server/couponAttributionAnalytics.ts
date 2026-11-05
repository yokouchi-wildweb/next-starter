// src/features/core/analytics/services/server/couponAttributionAnalytics.ts
// クーポン帰属報酬(発行者への報酬)の集計。
//
// コイン創出サマリーの合計には入れない(付与は wallet の bonus の行で、wallet_bonus_grant に含まれる。並べると二重計上)。
// 内訳を見たい画面・fork のソースがこの関数を呼ぶ(referralAnalytics の aggregateReferralRewardCurrentVsPrev と対)。
// クーポンの機能を閉じている間は表が無いことがあるので、閉じていれば 0 を返す(gate.enabled("coupon"))。
//
// 集計対象: coupon_attribution_rewards のうち status='fulfilled' の amount を fulfilled_at で期間集計する。
// UserFilter・分析の除外: 受取人(recipient_user_id)に適用する(flow の scope、source coupon_attribution_rewards)。

import { and, between, eq, sql } from "drizzle-orm";

import { gate } from "@/featureGate";
import { db } from "@/lib/drizzle";
import { CouponAttributionRewardTable } from "@/features/core/couponAttributionReward/entities/drizzle";
import type { ResolvedDateRange, UserFilter } from "@/features/core/analytics/types/common";

import { buildUserFilterConditions } from "./utils/userFilter";

const r = CouponAttributionRewardTable;

export type AggregateCouponAttributionRewardCurrentVsPrevParams = {
  range: ResolvedDateRange;
  prevRange: { dateFrom: Date; dateTo: Date };
  userFilter?: UserFilter;
};

/** 当期と前期のクーポン帰属報酬の合計(1 クエリ) */
export async function aggregateCouponAttributionRewardCurrentVsPrev(
  params: AggregateCouponAttributionRewardCurrentVsPrevParams,
): Promise<{ current: number; previous: number }> {
  if (!gate.enabled("coupon")) return { current: 0, previous: 0 };
  const { range, prevRange } = params;
  const isCurrent = sql`(${r.fulfilled_at} >= ${range.dateFrom.toISOString()} AND ${r.fulfilled_at} <= ${range.dateTo.toISOString()})`;
  const isPrev = sql`(${r.fulfilled_at} >= ${prevRange.dateFrom.toISOString()} AND ${r.fulfilled_at} <= ${prevRange.dateTo.toISOString()})`;

  const rows = await db
    .select({
      current: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrent} THEN ${r.amount} ELSE 0 END), 0)`.as("current_total"),
      previous: sql<number>`COALESCE(SUM(CASE WHEN ${isPrev} THEN ${r.amount} ELSE 0 END), 0)`.as("prev_total"),
    })
    .from(r)
    .where(and(
      between(r.fulfilled_at, prevRange.dateFrom, range.dateTo),
      eq(r.status, "fulfilled"),
      ...buildUserFilterConditions(r.recipient_user_id, params.userFilter ?? {}, {
        kind: "flow",
        source: "coupon_attribution_rewards",
        rowId: r.id,
      }),
    ));

  return {
    current: Number(rows[0]?.current ?? 0),
    previous: Number(rows[0]?.previous ?? 0),
  };
}
