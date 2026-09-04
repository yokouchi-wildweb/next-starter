// クーポン使用可否判定

import { base } from "../drizzleBase";
import { getUsageCount } from "./getUsageCount";
import { validateCouponStatically } from "./utils";
import type { UsabilityResult } from "../../../types/redeem";

/**
 * クーポンの使用可否を判定する
 *
 * 判定順序:
 * 1. code で coupon 取得 → not_found
 * 2. 静的バリデーション（validateCouponStatically と共通）
 *    - status !== 'active' → inactive
 *    - valid_from > now → not_started
 *    - valid_until < now → expired
 *    - max_total_uses 到達 → max_total_reached
 *    - max_uses_per_redeemer 設定あり & userId なし → user_id_required
 *    - attribution_user_id === userId → self_redeem_forbidden
 * 3. max_uses_per_redeemer 到達 → max_per_user_reached（DB アクセス）
 * 4. すべてパス → usable: true
 *
 * redeem() と判定条件を共有するため、静的な項目は validateCouponStatically に
 * 集約している（ここで個別に条件を追加しないこと）。
 *
 * @param code クーポンコード
 * @param redeemerUserId 使用者のユーザーID（オプション。max_uses_per_redeemer 設定時は必須）
 */
export async function isUsable(
  code: string,
  redeemerUserId?: string | null
): Promise<UsabilityResult> {
  // 1. クーポン取得
  const result = await base.search({
    where: { field: "code", op: "eq", value: code },
    limit: 1,
  });
  const coupon = result.results[0];

  if (!coupon) {
    return { usable: false, reason: "not_found" };
  }

  // 2. 静的バリデーション
  const staticCheck = validateCouponStatically(coupon, redeemerUserId);
  if (!staticCheck.valid) {
    return { usable: false, reason: staticCheck.reason, coupon };
  }

  // 3. ユーザー毎の使用回数上限チェック（DB アクセス必要）
  if (coupon.max_uses_per_redeemer !== null && redeemerUserId) {
    const userUsageCount = await getUsageCount(coupon.id, redeemerUserId);
    if (userUsageCount >= coupon.max_uses_per_redeemer) {
      return { usable: false, reason: "max_per_user_reached", coupon };
    }
  }

  // 4. すべてパス
  return { usable: true, coupon };
}
