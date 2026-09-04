// src/features/core/couponAttributionReward/constants/index.ts

/**
 * 帰属報酬のステータス。
 * - pending:   行は確保済みだがウォレット付与が未完了（付与処理の途中、または再試行待ち）
 * - fulfilled: ウォレット付与完了（wallet_history_id が確定）
 * - failed:    付与に失敗（failure_reason に理由。retryGrant で再試行可能）
 */
export const COUPON_ATTRIBUTION_REWARD_STATUSES = ["pending", "fulfilled", "failed"] as const;
export type CouponAttributionRewardStatus = (typeof COUPON_ATTRIBUTION_REWARD_STATUSES)[number];

export const CouponAttributionRewardStatusOptions = [
  { value: "pending", label: "保留" },
  { value: "fulfilled", label: "付与済" },
  { value: "failed", label: "失敗" },
] as const;
