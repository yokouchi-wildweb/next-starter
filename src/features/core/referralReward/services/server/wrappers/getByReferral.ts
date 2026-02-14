// referral に紐づく報酬一覧を取得

import { db } from "@/lib/drizzle";
import { ReferralRewardTable } from "../../../entities/drizzle";
import type { ReferralReward } from "../../../entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { eq, desc } from "drizzle-orm";

/**
 * referral_id に紐づく報酬レコード一覧を取得する
 *
 * @param referralId 紹介ID
 * @param tx トランザクション（オプション）
 * @returns ReferralReward[]
 */
export async function getByReferral(
  referralId: string,
  tx?: TransactionClient,
): Promise<ReferralReward[]> {
  const executor = tx ?? db;

  const rows = await executor
    .select()
    .from(ReferralRewardTable)
    .where(eq(ReferralRewardTable.referral_id, referralId))
    .orderBy(desc(ReferralRewardTable.createdAt));

  return rows as ReferralReward[];
}
