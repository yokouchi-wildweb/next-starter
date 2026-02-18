// カテゴリ付きクーポンバリデーション
//
// isUsable() の基本検証に加えて、カテゴリの一致確認と
// ハンドラーによるドメイン固有バリデーション + 効果プレビューを行う。

import { isUsable } from "../redemption/isUsable";
import "../../../handlers/init";
import { getCouponHandler } from "../../../handlers/registry";
import type { CategoryValidationResult } from "../../../types/redeem";

/**
 * カテゴリを指定してクーポンの有効性を検証する
 *
 * 検証順序:
 * 1. isUsable() — 基本検証（存在、ステータス、期限、使用回数）
 * 2. カテゴリ一致チェック
 * 3. ハンドラーの validateForUse() — ドメイン固有の追加検証
 * 4. ハンドラーの resolveEffect() — 効果のプレビュー計算
 *
 * @param code クーポンコード
 * @param category 期待するカテゴリ（例: "purchase_discount"）
 * @param userId 使用者のユーザーID
 * @param metadata ドメイン固有のコンテキスト情報（例: { paymentAmount: 2000 }）
 */
export async function validateForCategory(
  code: string,
  category: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<CategoryValidationResult> {
  // 1. 基本検証
  const usability = await isUsable(code, userId);
  if (!usability.usable) {
    return { valid: false, reason: usability.reason, coupon: usability.coupon };
  }

  const { coupon } = usability;

  // 2. カテゴリ一致チェック
  if (coupon.category !== category) {
    return { valid: false, reason: "category_mismatch", coupon };
  }

  // 3. ハンドラーによる追加検証
  const handler = getCouponHandler(category);
  if (handler?.validateForUse) {
    const handlerResult = await handler.validateForUse({
      coupon,
      userId,
      metadata,
    });
    if (!handlerResult.valid) {
      return {
        valid: false,
        reason: handlerResult.reason ?? "handler_rejected",
        coupon,
      };
    }
  }

  // 4. 効果のプレビュー計算
  let effect: Record<string, unknown> | null = null;
  if (handler?.resolveEffect) {
    effect = await handler.resolveEffect({ coupon, userId, metadata });
  }

  return { valid: true, coupon, effect };
}
