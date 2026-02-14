// 被招待者から紹介元を取得

import { db } from "@/lib/drizzle";
import { ReferralTable } from "../../../entities/drizzle";
import type { Referral } from "../../../entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { eq, and } from "drizzle-orm";

/**
 * 被招待者のユーザーIDから紹介レコードを取得
 *
 * @param inviteeUserId 被招待者のユーザーID
 * @param tx トランザクション（オプション）
 * @returns Referral または null
 */
export async function getByInvitee(
  inviteeUserId: string,
  tx?: TransactionClient,
): Promise<Referral | null> {
  const executor = tx ?? db;

  const rows = await executor
    .select()
    .from(ReferralTable)
    .where(
      and(
        eq(ReferralTable.invitee_user_id, inviteeUserId),
        eq(ReferralTable.status, "active"),
      )
    )
    .limit(1);

  return (rows[0] as Referral | undefined) ?? null;
}
