// クーポン使用可否判定

import { base } from "../drizzleBase";
import { getUsageCount } from "./getUsageCount";
import type { UsabilityResult } from "../../../types/redeem";

/**
 * クーポンの使用可否を判定する
 *
 * 判定順序:
 * 1. code で coupon 取得 → not_found
 * 2. status !== 'active' → inactive
 * 3. valid_from > now → not_started
 * 4. valid_until < now → expired
 * 5. max_total_uses 到達 → max_total_reached
 * 6. max_uses_per_redeemer 設定あり & userId なし → user_id_required
 * 7. max_uses_per_redeemer 到達 → max_per_user_reached
 * 8. すべてパス → usable: true
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

  // 2. ステータスチェック
  if (coupon.status !== "active") {
    return { usable: false, reason: "inactive", coupon };
  }

  const now = new Date();

  // 3. 開始日チェック
  if (coupon.valid_from && coupon.valid_from > now) {
    return { usable: false, reason: "not_started", coupon };
  }

  // 4. 終了日チェック
  if (coupon.valid_until && coupon.valid_until < now) {
    return { usable: false, reason: "expired", coupon };
  }

  // 5. 総使用回数上限チェック
  if (
    coupon.max_total_uses !== null &&
    coupon.current_total_uses >= coupon.max_total_uses
  ) {
    return { usable: false, reason: "max_total_reached", coupon };
  }

  // 6. ユーザー毎の使用回数上限チェック
  if (coupon.max_uses_per_redeemer !== null) {
    // ユーザーIDが必須
    if (!redeemerUserId) {
      return { usable: false, reason: "user_id_required", coupon };
    }
    const userUsageCount = await getUsageCount(coupon.id, redeemerUserId);
    if (userUsageCount >= coupon.max_uses_per_redeemer) {
      return { usable: false, reason: "max_per_user_reached", coupon };
    }
  }

  // 7. すべてパス
  return { usable: true, coupon };
}
