// ハンドラー付きクーポン使用処理
//
// 標準の redeem() に加えて、ハンドラーの onRedeemed() を呼び出す。
// 使用記録後の追加処理（分析イベント送信、追加報酬付与など）を
// 消費側ドメインのハンドラーに委譲する。

import { redeem } from "../redemption/redeem";
import "../../../handlers/init";
import { getCouponHandler } from "../../../handlers/registry";
import type { RedeemWithEffectResult } from "../../../types/redeem";
import type { TransactionClient } from "@/lib/drizzle/transaction";

/**
 * クーポンを使用し、ハンドラーの追加処理を実行する
 *
 * 処理フロー:
 * 1. redeem() — 標準の使用処理（検証 + 使用回数更新 + 履歴記録）
 * 2. ハンドラーの onRedeemed() — 追加の副作用処理
 *
 * @param code クーポンコード
 * @param userId 使用者のユーザーID
 * @param metadata ドメイン固有のコンテキスト情報
 * @param tx 外部トランザクション（オプション）
 */
export async function redeemWithEffect(
  code: string,
  userId: string,
  metadata?: Record<string, unknown>,
  tx?: TransactionClient
): Promise<RedeemWithEffectResult> {
  // 1. 標準の使用処理
  const redeemResult = await redeem(code, userId, metadata, tx);
  if (!redeemResult.success) {
    return redeemResult;
  }

  // 2. ハンドラーの追加処理（redeem() が返した coupon を利用し、再取得を回避）
  const { coupon } = redeemResult;
  if (coupon.category) {
    const handler = getCouponHandler(coupon.category);
    if (handler?.onRedeemed) {
      await handler.onRedeemed({
        coupon,
        userId,
        metadata,
        history: redeemResult.history,
      });
    }
  }

  return redeemResult;
}
