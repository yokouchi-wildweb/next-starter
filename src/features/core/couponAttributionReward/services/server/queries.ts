// src/features/core/couponAttributionReward/services/server/queries.ts

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { CouponAttributionRewardTable } from "@/features/core/couponAttributionReward/entities/drizzle";
import type {
  CouponAttributionReward,
  CouponAttributionRewardSummary,
} from "@/features/core/couponAttributionReward/entities/model";

/** 消込履歴 ID から台帳行を取得（未付与なら null） */
export async function getRewardByCouponHistory(
  couponHistoryId: string,
  tx?: TransactionClient,
): Promise<CouponAttributionReward | null> {
  const executor = tx ?? db;
  const [row] = await executor
    .select()
    .from(CouponAttributionRewardTable)
    .where(eq(CouponAttributionRewardTable.coupon_history_id, couponHistoryId))
    .limit(1);
  return (row as CouponAttributionReward | undefined) ?? null;
}

/**
 * 受取人ごとの集計（マイページの「累計報酬」表示用）。
 * 1 クエリで fulfilled 合計/件数と pending 合計を返す。
 */
export async function getRecipientRewardSummary(
  recipientUserId: string,
  tx?: TransactionClient,
): Promise<CouponAttributionRewardSummary> {
  const executor = tx ?? db;
  const t = CouponAttributionRewardTable;
  const [row] = await executor
    .select({
      fulfilledAmount: sql<number>`COALESCE(SUM(CASE WHEN ${t.status} = 'fulfilled' THEN ${t.amount} ELSE 0 END), 0)::bigint`,
      fulfilledCount: sql<number>`COUNT(*) FILTER (WHERE ${t.status} = 'fulfilled')::bigint`,
      pendingAmount: sql<number>`COALESCE(SUM(CASE WHEN ${t.status} = 'pending' THEN ${t.amount} ELSE 0 END), 0)::bigint`,
    })
    .from(t)
    .where(and(eq(t.recipient_user_id, recipientUserId)));

  return {
    fulfilledAmount: Number(row?.fulfilledAmount ?? 0),
    fulfilledCount: Number(row?.fulfilledCount ?? 0),
    pendingAmount: Number(row?.pendingAmount ?? 0),
  };
}
