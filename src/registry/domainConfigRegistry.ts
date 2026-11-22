// 生成物・編集不可: pnpm generate registry が src/domains/**/domain.json から生成する
// src/registry/domainConfigRegistry.ts
//
// 全ドメインの domain.json の一覧(キー = フォルダ名の snake_case)。読み手: src/wiring/domainConfig.ts

import "server-only";

import type { DomainConfigOptionals } from "@/lib/domain";

import chatRoomConfig from "@/domains/core/chatRoom/domain.json";
import couponConfig from "@/domains/core/coupon/domain.json";
import couponHistoryConfig from "@/domains/core/couponHistory/domain.json";
import milestoneConfig from "@/domains/core/milestone/domain.json";
import purchaseQuotaConfig from "@/domains/core/purchaseQuota/domain.json";
import rateLimitConfig from "@/domains/core/rateLimit/domain.json";
import referralConfig from "@/domains/core/referral/domain.json";
import referralRewardConfig from "@/domains/core/referralReward/domain.json";
import userConfig from "@/domains/core/user/domain.json";
import userLineProfileConfig from "@/domains/core/userLineProfile/domain.json";
import userTagConfig from "@/domains/core/userTag/domain.json";
import sampleConfig from "@/domains/sample/domain.json";
import sampleCategoryConfig from "@/domains/sampleCategory/domain.json";
import sampleImageConfig from "@/domains/sampleImage/domain.json";
import sampleTagConfig from "@/domains/sampleTag/domain.json";

export const domainConfigMap = {
  chat_room: chatRoomConfig,
  coupon: couponConfig,
  coupon_history: couponHistoryConfig,
  milestone: milestoneConfig,
  purchase_quota: purchaseQuotaConfig,
  rate_limit: rateLimitConfig,
  referral: referralConfig,
  referral_reward: referralRewardConfig,
  user: userConfig,
  user_line_profile: userLineProfileConfig,
  user_tag: userTagConfig,
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_image: sampleImageConfig,
  sample_tag: sampleTagConfig,
} as const;

export type DomainKey = keyof typeof domainConfigMap;

export type DomainConfig = (typeof domainConfigMap)[DomainKey] & DomainConfigOptionals;
