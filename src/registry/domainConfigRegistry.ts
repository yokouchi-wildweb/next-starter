// src/registry/domainConfigRegistry.ts

import sampleConfig from "@/features/sample/domain.json";
import sampleCategoryConfig from "@/features/sampleCategory/domain.json";
import sampleTagConfig from "@/features/sampleTag/domain.json";
import couponConfig from "@/features/core/coupon/domain.json";
import couponHistoryConfig from "@/features/core/couponHistory/domain.json";
import userConfig from "@/features/core/user/domain.json";
import rateLimitConfig from "@/features/core/rateLimit/domain.json";
import userTagConfig from "@/features/core/userTag/domain.json";
import referralConfig from "@/features/core/referral/domain.json";
import referralRewardConfig from "@/features/core/referralReward/domain.json";

export const domainConfigMap = {

  // --- AUTO-GENERATED-START ---
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_tag: sampleTagConfig,
  coupon: couponConfig,
  coupon_history: couponHistoryConfig,
  rate_limit: rateLimitConfig,
  user_tag: userTagConfig,
  referral: referralConfig,
  referral_reward: referralRewardConfig,
  // --- AUTO-GENERATED-END ---

  // --- CORE DOMAINS (手動管理) ---
  user: userConfig,

} as const;

export type DomainKey = keyof typeof domainConfigMap;
export type DomainConfig = (typeof domainConfigMap)[DomainKey];
