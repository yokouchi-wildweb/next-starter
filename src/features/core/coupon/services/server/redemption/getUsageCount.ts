// 特定ユーザーのクーポン使用回数を取得

import { db } from "@/lib/drizzle";
import { CouponHistoryTable } from "@/features/core/couponHistory/entities/drizzle";
import { and, eq, count } from "drizzle-orm";
import type { TransactionClient } from "./utils";

/**
 * 特定ユーザーの特定クーポンの使用回数を取得
 */
export async function getUsageCount(
  couponId: string,
  redeemerId: string,
  tx?: TransactionClient
): Promise<number> {
  const executor = tx ?? db;
  const result = await executor
    .select({ count: count() })
    .from(CouponHistoryTable)
    .where(
      and(
        eq(CouponHistoryTable.coupon_id, couponId),
        eq(CouponHistoryTable.redeemer_user_id, redeemerId)
      )
    );

  return result[0]?.count ?? 0;
}
