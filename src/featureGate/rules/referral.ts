// src/featureGate/rules/referral.ts
// マーケティング > 紹介

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/mypage/invite",
    // /api/referral(と自前の /api/referral/**)・/api/referralReward は features から導く
    "/api/admin/referral",
    // 招待クーポン(type invite)の管理画面は紹介の画面(coupon の /admin/coupons と重なる、OR)
    "/admin/coupons/invite",
  ],
  features: [
    "core/referral",
    "core/referralReward",
  ],
  enabled: () => APP_FEATURES.marketing.referral.enabled,
};
