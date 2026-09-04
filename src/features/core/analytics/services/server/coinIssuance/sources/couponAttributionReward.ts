// src/features/core/analytics/services/server/coinIssuance/sources/couponAttributionReward.ts
// coinIssuance ソース: クーポン帰属報酬（発行者への報酬）によるコイン発行。
//
// 集計対象:
//   coupon_attribution_rewards のうち status='fulfilled' の amount を fulfilled_at で期間集計する。
//   金額は typed 列（amount）なので metadata 抽出式の差し替えは不要。
//
// UserFilter:
//   受取人（recipient_user_id）に対して適用する（デモ発行者の報酬を除外できるように）。

import { and, between, eq, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { CouponAttributionRewardTable } from "@/features/core/couponAttributionReward/entities/drizzle";
import { buildUserFilterConditions } from "../../utils/userFilter";
import type { CoinIssuanceSource } from "../types";

const r = CouponAttributionRewardTable;

export const couponAttributionRewardSource: CoinIssuanceSource = {
  key: "coupon_attribution_reward",
  kind: "issuance",

  async aggregate({ range, prevRange, userFilter }) {
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
        ...buildUserFilterConditions(r.recipient_user_id, userFilter),
      ));

    return {
      current: Number(rows[0]?.current ?? 0),
      previous: Number(rows[0]?.previous ?? 0),
    };
  },
};
