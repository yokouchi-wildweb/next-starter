// クーポン使用履歴の記録

import { db } from "@/lib/drizzle";
import { CouponHistoryTable } from "../../entities/drizzle";
import type { CouponHistory } from "../../entities/model";
import type { CouponSnapshot, CouponUsageMetadata } from "../../types/metadata";

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
export async function recordUsage({
  couponId,
  redeemerUserId,
  snapshot,
  currentTotalUsesAfter,
  additionalMetadata,
}: RecordUsageParams): Promise<CouponHistory> {
  const metadata: CouponUsageMetadata = {
    ...snapshot,
    current_total_uses_after: currentTotalUsesAfter,
    ...additionalMetadata,
  };

  const [history] = await db
    .insert(CouponHistoryTable)
    .values({
      coupon_id: couponId,
      redeemer_user_id: redeemerUserId,
      metadata,
    })
    .returning();

  return history as CouponHistory;
}
