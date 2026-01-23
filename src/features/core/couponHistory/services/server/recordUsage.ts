// クーポン使用履歴の記録

import { db } from "@/lib/drizzle";
import { CouponHistoryTable } from "../../entities/drizzle";
import type { CouponHistory } from "../../entities/model";
import type { CouponSnapshot, CouponUsageMetadata } from "../../types/metadata";
import type { TransactionClient } from "@/lib/drizzle/transaction";

type RecordUsageParams = {
  couponId: string;
  redeemerUserId: string | null;
  snapshot: Omit<CouponSnapshot, "current_total_uses_after">;
  currentTotalUsesAfter: number;
  additionalMetadata?: Record<string, unknown>;
};

/**
 * クーポン使用履歴を記録する
 */
export async function recordUsage(
  params: RecordUsageParams,
  tx?: TransactionClient
): Promise<CouponHistory> {
  const {
    couponId,
    redeemerUserId,
    snapshot,
    currentTotalUsesAfter,
    additionalMetadata,
  } = params;

  const metadata: CouponUsageMetadata = {
    ...snapshot,
    current_total_uses_after: currentTotalUsesAfter,
    ...additionalMetadata,
  };

  const executor = tx ?? db;
  const [history] = await executor
    .insert(CouponHistoryTable)
    .values({
      coupon_id: couponId,
      redeemer_user_id: redeemerUserId,
      metadata,
    })
    .returning();

  return history as CouponHistory;
}
