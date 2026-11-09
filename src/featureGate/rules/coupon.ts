// src/featureGate/rules/coupon.ts
// マーケティング > クーポン(紹介の報酬 couponAttributionReward は自分の機能、rules/couponAttributionReward.ts)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/coupons",
    "/api/me/coupon-issuer",
    "/api/admin/coupon-issuer-grants",
  ],
  features: [
    "core/coupon",
    "core/couponHistory",
    "core/couponIssuerGrant",
  ],
  enabled: () => APP_FEATURES.marketing.coupon.enabled,
};
