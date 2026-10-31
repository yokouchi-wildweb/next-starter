// 生成物・編集不可: pnpm registry:generate が src/features/**/domain.json から生成する
// src/registry/domainConfigRegistry.ts
//
// 全ドメインの domain.json の一覧(キー = フォルダ名の snake_case)。読み手: src/wiring/domainConfig.ts

import "server-only";

import type { DomainConfigOptionals } from "@/lib/domain/types/domainConfigOptionals";

import chatRoomConfig from "@/features/core/chatRoom/domain.json";
import couponConfig from "@/features/core/coupon/domain.json";
import couponHistoryConfig from "@/features/core/couponHistory/domain.json";
import milestoneConfig from "@/features/core/milestone/domain.json";
import notificationConfig from "@/features/core/notification/domain.json";
import notificationTemplateConfig from "@/features/core/notificationTemplate/domain.json";
import purchaseQuotaConfig from "@/features/core/purchaseQuota/domain.json";
import rateLimitConfig from "@/features/core/rateLimit/domain.json";
import referralConfig from "@/features/core/referral/domain.json";
import referralRewardConfig from "@/features/core/referralReward/domain.json";
import userConfig from "@/features/core/user/domain.json";
import userLineProfileConfig from "@/features/core/userLineProfile/domain.json";
import userTagConfig from "@/features/core/userTag/domain.json";
import sampleConfig from "@/features/sample/domain.json";
import sampleCategoryConfig from "@/features/sampleCategory/domain.json";
import sampleImageConfig from "@/features/sampleImage/domain.json";
import sampleTagConfig from "@/features/sampleTag/domain.json";

export const domainConfigMap = {
  chat_room: chatRoomConfig,
  coupon: couponConfig,
  coupon_history: couponHistoryConfig,
  milestone: milestoneConfig,
  notification: notificationConfig,
  notification_template: notificationTemplateConfig,
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
