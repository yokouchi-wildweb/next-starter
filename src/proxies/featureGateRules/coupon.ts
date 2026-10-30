// src/proxies/featureGateRules/coupon.ts
// マーケティング > クーポン

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/coupons",
    "/api/coupon",
    "/api/couponHistory",
    "/api/couponAttributionReward",
    "/api/couponIssuerGrant",
    "/api/me/coupon-issuer",
    "/api/me/coupon-attribution-rewards",
    "/api/admin/coupon-issuer-grants",
  ],
  features: [
    "core/coupon",
    "core/couponHistory",
    "core/couponAttributionReward",
    "core/couponIssuerGrant",
  ],
  enabled: () => APP_FEATURES.marketing.coupon.enabled,
};
