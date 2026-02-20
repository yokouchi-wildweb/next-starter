// クーポン使用処理

import { CouponTable } from "../../../entities/drizzle";
import { recordUsage } from "@/features/core/couponHistory/services/server/recordUsage";
import { eq, sql } from "drizzle-orm";
import { getUsageCount } from "./getUsageCount";
import {
  type TransactionClient,
  runWithTransaction,
  getCouponByCode,
  validateCouponStatically,
} from "./utils";
import type { RedeemResult } from "../../../types/redeem";
import type { Coupon } from "../../../entities/model";

/**
 * クーポンを使用する
 *
 * 処理フロー:
 * 1. トランザクション内で:
 *    - SELECT FOR UPDATE でロック取得
 *    - 静的バリデーション
 *    - ユーザー使用回数チェック（max_uses_per_redeemer 設定時）
 *    - current_total_uses をインクリメント
 *    - 履歴記録
 * 2. 結果を返却
 *
 * @param code クーポンコード
 * @param redeemerUserId 使用者のユーザーID（オプション。max_uses_per_redeemer 設定時は必須）
 * @param additionalMetadata 追加のメタデータ（履歴に記録）
 * @param tx 外部トランザクション（オプション）
 */
export async function redeem(
  code: string,
  redeemerUserId?: string | null,
  additionalMetadata?: Record<string, unknown>,
  tx?: TransactionClient
): Promise<RedeemResult> {
  return runWithTransaction(tx, async (trx) => {
    // SELECT FOR UPDATE でロック取得
    const lockedCoupon = await getCouponByCode(code, trx, { lock: true });

    if (!lockedCoupon) {
      return { success: false, reason: "not_found" as const };
    }

    // 静的バリデーション
    const staticCheck = validateCouponStatically(lockedCoupon, redeemerUserId);
    if (!staticCheck.valid) {
      return { success: false, reason: staticCheck.reason };
    }

    // ユーザー毎の使用回数上限チェック（DB アクセス必要）
    if (lockedCoupon.max_uses_per_redeemer !== null && redeemerUserId) {
      const userUsageCount = await getUsageCount(lockedCoupon.id, redeemerUserId, trx);
      if (userUsageCount >= lockedCoupon.max_uses_per_redeemer) {
        return { success: false, reason: "max_per_user_reached" as const };
      }
    }

    // current_total_uses をインクリメント
    const newTotalUses = lockedCoupon.current_total_uses + 1;
    await trx
      .update(CouponTable)
      .set({
        current_total_uses: newTotalUses,
        updatedAt: sql`now()`,
      })
      .where(eq(CouponTable.id, lockedCoupon.id));

    // 履歴記録
    const history = await recordUsage(
      {
        couponId: lockedCoupon.id,
        redeemerUserId: redeemerUserId ?? null,
        snapshot: {
          code: lockedCoupon.code,
          type: lockedCoupon.type,
          name: lockedCoupon.name,
          attribution_user_id: lockedCoupon.attribution_user_id,
        },
        currentTotalUsesAfter: newTotalUses,
        additionalMetadata,
      },
      trx
    );

    return { success: true, history, coupon: lockedCoupon };
  });
}
