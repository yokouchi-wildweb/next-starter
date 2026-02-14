// クーポン使用 → referral 作成のブリッジ

import { db } from "@/lib/drizzle";
import { ReferralTable } from "../../../entities/drizzle";
import type { Referral } from "../../../entities/model";
import type { Coupon } from "@/features/core/coupon/entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { eq } from "drizzle-orm";

/**
 * クーポン使用情報から referral レコードを作成する
 *
 * - クーポンの attribution_user_id を招待者として referral を作成
 * - 既に invitee の referral が存在する場合はスキップ（冪等性）
 * - attribution_user_id がない場合は null を返す（招待クーポンではない）
 *
 * @param coupon 使用されたクーポン
 * @param inviteeUserId 被招待者（クーポン使用者）のユーザーID
 * @param tx トランザクション（オプション）
 * @returns 作成された Referral、または既存/スキップ時は null
 */
export async function createReferralFromRedemption(
  coupon: Coupon,
  inviteeUserId: string,
  tx?: TransactionClient,
): Promise<Referral | null> {
  // 招待クーポン以外、または attribution_user_id がない場合はスキップ
  if (coupon.type !== "invite" || !coupon.attribution_user_id) {
    return null;
  }

  // 自分自身の招待コードを使用した場合はスキップ
  if (coupon.attribution_user_id === inviteeUserId) {
    return null;
  }

  const executor = tx ?? db;

  // 既に referral が存在するかチェック（unique 制約の事前確認）
  const existing = await executor
    .select()
    .from(ReferralTable)
    .where(eq(ReferralTable.invitee_user_id, inviteeUserId))
    .limit(1);

  if (existing.length > 0) {
    return null;
  }

  const [created] = await executor
    .insert(ReferralTable)
    .values({
      coupon_id: coupon.id,
      inviter_user_id: coupon.attribution_user_id,
      invitee_user_id: inviteeUserId,
      status: "active",
    })
    .returning();

  return created as Referral;
}
