// src/features/core/couponAttributionReward/index.ts
//
// 帰属報酬ドメインの公開エントリーポイント (client-safe)。
//
// 付与 (grant / retry) などの server-only API はこのバレルから export しない。
// server コードからの利用は専用パスを使う:
//   import { couponAttributionRewardService } from "@/features/core/couponAttributionReward/services/server";

export type {
  CouponAttributionReward,
  CouponAttributionRewardSummary,
} from "./entities/model";
export {
  COUPON_ATTRIBUTION_REWARD_STATUSES,
  CouponAttributionRewardStatusOptions,
  type CouponAttributionRewardStatus,
} from "./constants";
