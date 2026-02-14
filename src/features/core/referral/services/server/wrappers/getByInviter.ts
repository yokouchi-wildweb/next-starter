// 招待者の紹介一覧を取得

import { db } from "@/lib/drizzle";
import { ReferralTable } from "../../../entities/drizzle";
import type { Referral } from "../../../entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { eq, and, desc } from "drizzle-orm";

/**
 * 招待者のユーザーIDから紹介一覧を取得
 *
 * @param inviterUserId 招待者のユーザーID
 * @param options フィルタオプション
 * @param tx トランザクション（オプション）
 * @returns Referral[]
 */
export async function getByInviter(
  inviterUserId: string,
  options?: { activeOnly?: boolean },
  tx?: TransactionClient,
): Promise<Referral[]> {
  const executor = tx ?? db;
  const { activeOnly = true } = options ?? {};

  const conditions = [eq(ReferralTable.inviter_user_id, inviterUserId)];

  if (activeOnly) {
    conditions.push(eq(ReferralTable.status, "active"));
  }

  const rows = await executor
    .select()
    .from(ReferralTable)
    .where(and(...conditions))
    .orderBy(desc(ReferralTable.createdAt));

  return rows as Referral[];
}
