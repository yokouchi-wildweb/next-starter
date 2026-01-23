// クーポン使用処理

import { db } from "@/lib/drizzle";
import { CouponTable } from "../../../entities/drizzle";
import { couponHistoryService } from "@/features/core/couponHistory/services/server/couponHistoryService";
import { eq, sql } from "drizzle-orm";
import { isUsable } from "./isUsable";
import { getUsageCount } from "./getUsageCount";
import type { RedeemResult } from "../../../types/redeem";
import type { Coupon } from "../../../entities/model";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * クーポンを使用する
 *
 * 処理フロー:
 * 1. isUsable で使用可否判定
 * 2. トランザクション内で:
 *    - SELECT FOR UPDATE でロック取得
 *    - 再度使用可否を確認（楽観的ロック対策）
 *    - current_total_uses をインクリメント
 *    - 履歴記録
 * 3. 結果を返却
 *
 * @param code クーポンコード
 * @param redeemerUserId 使用者のユーザーID（オプション。max_uses_per_redeemer 設定時は必須）
 * @param additionalMetadata 追加のメタデータ（履歴に記録）
 */
export async function redeem(
  code: string,
  redeemerUserId?: string | null,
  additionalMetadata?: Record<string, unknown>
): Promise<RedeemResult> {
  // 1. 事前チェック（トランザクション外）
  const usabilityResult = await isUsable(code, redeemerUserId);
  if (!usabilityResult.usable) {
    return { success: false, reason: usabilityResult.reason };
  }

  const coupon = usabilityResult.coupon;

  // 2. トランザクション内で処理
  const result = await db.transaction(async (tx: TransactionClient) => {
    // SELECT FOR UPDATE でロック取得
    const lockedRows = await tx
      .select()
      .from(CouponTable)
      .where(eq(CouponTable.id, coupon.id))
      .for("update");

    const lockedCoupon = lockedRows[0] as Coupon | undefined;
    if (!lockedCoupon) {
      return { success: false, reason: "not_found" as const };
    }

    // 再度使用可否を確認（競合対策）
    // ステータスチェック
    if (lockedCoupon.status !== "active") {
      return { success: false, reason: "inactive" as const };
    }

    const now = new Date();

    // 期間チェック
    if (lockedCoupon.valid_from && lockedCoupon.valid_from > now) {
      return { success: false, reason: "not_started" as const };
    }
    if (lockedCoupon.valid_until && lockedCoupon.valid_until < now) {
      return { success: false, reason: "expired" as const };
    }

    // 総使用回数上限チェック
    if (
      lockedCoupon.max_total_uses !== null &&
      lockedCoupon.current_total_uses >= lockedCoupon.max_total_uses
    ) {
      return { success: false, reason: "max_total_reached" as const };
    }

    // ユーザー毎の使用回数上限チェック
    if (lockedCoupon.max_uses_per_redeemer !== null) {
      // isUsable で user_id_required チェック済みだが、念のため再チェック
      if (!redeemerUserId) {
        return { success: false, reason: "user_id_required" as const };
      }
      const userUsageCount = await getUsageCount(lockedCoupon.id, redeemerUserId);
      if (userUsageCount >= lockedCoupon.max_uses_per_redeemer) {
        return { success: false, reason: "max_per_user_reached" as const };
      }
    }

    // current_total_uses をインクリメント
    const newTotalUses = lockedCoupon.current_total_uses + 1;
    await tx
      .update(CouponTable)
      .set({
        current_total_uses: newTotalUses,
        updatedAt: sql`now()`,
      })
      .where(eq(CouponTable.id, lockedCoupon.id));

    // 履歴記録（redeemerUserId は null の場合あり）
    const history = await couponHistoryService.recordUsage({
      couponId: lockedCoupon.id,
      redeemerUserId: redeemerUserId ?? null,
      snapshot: {
        code: lockedCoupon.code,
        type: lockedCoupon.type,
        name: lockedCoupon.name,
        owner_id: lockedCoupon.owner_id,
      },
      currentTotalUsesAfter: newTotalUses,
      additionalMetadata,
    });

    return { success: true, history };
  });

  return result as RedeemResult;
}
