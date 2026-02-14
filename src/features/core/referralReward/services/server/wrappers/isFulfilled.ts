// 報酬配布済み確認

import { db } from "@/lib/drizzle";
import { ReferralRewardTable } from "../../../entities/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { eq, and } from "drizzle-orm";

/**
 * 特定の reward_key が指定 referral に対して配布済みかどうか確認する
 *
 * @param referralId 紹介ID
 * @param rewardKey 報酬キー
 * @param tx トランザクション（オプション）
 * @returns true = fulfilled 済み
 */
export async function isFulfilled(
  referralId: string,
  rewardKey: string,
  tx?: TransactionClient,
): Promise<boolean> {
  const executor = tx ?? db;

  const rows = await executor
    .select({ status: ReferralRewardTable.status })
    .from(ReferralRewardTable)
    .where(
      and(
        eq(ReferralRewardTable.referral_id, referralId),
        eq(ReferralRewardTable.reward_key, rewardKey),
      )
    )
    .limit(1);

  if (rows.length === 0) return false;
  return rows[0].status === "fulfilled";
}
