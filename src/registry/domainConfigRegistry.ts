// src/registry/domainConfigRegistry.ts

// --- Core imports ---
import userConfig from "@/features/user/domain.json";
import couponConfig from "@/features/coupon/domain.json";
import couponHistoryConfig from "@/features/couponHistory/domain.json";
import rateLimitConfig from "@/features/rateLimit/domain.json";
import userTagConfig from "@/features/userTag/domain.json";
import referralConfig from "@/features/referral/domain.json";
import referralRewardConfig from "@/features/referralReward/domain.json";
import milestoneConfig from "@/features/milestone/domain.json";
import notificationConfig from "@/features/notification/domain.json";
import notificationTemplateConfig from "@/features/notificationTemplate/domain.json";

// --- Auto-generated imports ---
import sampleConfig from "@/features/sample/domain.json";
import sampleCategoryConfig from "@/features/sampleCategory/domain.json";
import sampleTagConfig from "@/features/sampleTag/domain.json";
import chatRoomConfig from "@/features/core/chatRoom/domain.json";

export const domainConfigMap = {

  // --- CORE DOMAINS (手動管理) ---
  user: userConfig,
  coupon: couponConfig,
  coupon_history: couponHistoryConfig,
  rate_limit: rateLimitConfig,
  user_tag: userTagConfig,
  referral: referralConfig,
  referral_reward: referralRewardConfig,
  milestone: milestoneConfig,
  notification: notificationConfig,
  notification_template: notificationTemplateConfig,
  chat_room: chatRoomConfig,

  // --- AUTO-GENERATED-START ---
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_tag: sampleTagConfig,
  // --- AUTO-GENERATED-END ---

} as const;

export type DomainKey = keyof typeof domainConfigMap;
export type DomainConfig = (typeof domainConfigMap)[DomainKey];
