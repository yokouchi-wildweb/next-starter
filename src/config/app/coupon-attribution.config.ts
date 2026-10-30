// src/config/app/coupon-attribution.config.ts
// 帰属報酬台帳（coupon_attribution_rewards.metadata）のうち、受取人本人へ開示してよい
// metadata キーの許可リスト。
//
// GET /api/me/coupon-attribution-rewards は、ここに登録されたキーだけを
// metadata に残して返す（toCouponAttributionRewardForRecipient）。
//
// fail-closed: 未登録のキーは一切返さない。metadata には下流ハンドラーが
// 消込者の購入 ID（purchaseRequestId 等）のような追跡用情報を書くため、既定は「全キー非開示」。
// 発行者（受取人）が「誰が消込したか」を知れないことを保つには、
// 消込者・購入に辿れる値を含むキーは登録しないこと。
//
// 登録例（下流ドメイン。報酬率と購入金額のみ画面表示に使う場合）:
//

export const RECIPIENT_VISIBLE_ATTRIBUTION_REWARD_METADATA_KEYS: readonly string[] = [];
