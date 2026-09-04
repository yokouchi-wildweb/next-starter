// クーポン使用不可理由 → ユーザー向けメッセージ
//
// API ルート（check-usability / redeem / validate-for-category）で共有する。
// UsabilityReason を追加したら必ずここにも追加する（型で網羅を強制）。

import type { UsabilityReason } from "../types/redeem";

export const COUPON_REDEEM_REASON_MESSAGES: Record<UsabilityReason, string> = {
  not_found: "クーポンが見つかりません。",
  inactive: "このクーポンは無効です。",
  not_started: "このクーポンはまだ使用開始前です。",
  expired: "このクーポンは有効期限切れです。",
  max_total_reached: "このクーポンの使用上限に達しました。",
  max_per_user_reached: "このクーポンの使用上限に達しました。",
  user_id_required: "このクーポンを使用するにはログインが必要です。",
  self_redeem_forbidden: "ご自身が発行したクーポンは使用できません。",
  category_mismatch: "このクーポンはこの用途には使用できません。",
  handler_rejected: "このクーポンの使用条件を満たしていません。",
};

export const COUPON_REDEEM_FALLBACK_MESSAGE = "クーポンを使用できません。";

/**
 * 理由コードからユーザー向けメッセージを解決する
 *
 * ハンドラー由来の自由文字列 reason（validateForUse が返すもの）は
 * そのまま表示テキストとして扱う。未知のコードはフォールバック文言。
 */
export function getCouponRedeemReasonMessage(reason: string): string {
  if (reason in COUPON_REDEEM_REASON_MESSAGES) {
    return COUPON_REDEEM_REASON_MESSAGES[reason as UsabilityReason];
  }
  return reason || COUPON_REDEEM_FALLBACK_MESSAGE;
}
