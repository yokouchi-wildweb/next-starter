// src/features/core/couponAttributionReward/entities/model.ts

import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { CouponAttributionRewardStatus } from "@/features/core/couponAttributionReward/constants";

export type CouponAttributionReward = {
  id: string;
  coupon_id: string;
  coupon_history_id: string;
  recipient_user_id: string;
  redeemer_user_id: string | null;
  wallet_type: WalletTypeValue;
  amount: number;
  status: CouponAttributionRewardStatus;
  wallet_history_id: string | null;
  fulfilled_at: Date | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

/** 受取人本人向けの集計（GET /api/me/coupon-attribution-rewards/summary） */
export type CouponAttributionRewardSummary = {
  /** fulfilled の合計額 */
  fulfilledAmount: number;
  /** fulfilled の件数 */
  fulfilledCount: number;
  /** pending の合計額（付与途中・再試行待ち） */
  pendingAmount: number;
};
