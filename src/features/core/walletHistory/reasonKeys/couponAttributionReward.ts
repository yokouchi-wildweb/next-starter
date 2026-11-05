// src/features/core/walletHistory/reasonKeys/couponAttributionReward.ts
// クーポン帰属報酬(発行者への報酬)の付与。書き手: couponAttributionReward/services/server/grant.ts

import type { WalletReasonKeyItem } from "@/features/core/walletHistory/types/reasonKey";

export const reasonKey: WalletReasonKeyItem = {
  key: "coupon_attribution_reward",
  label: "クーポン帰属報酬",
  category: "bonus",
  sortOrder: 20,
};
