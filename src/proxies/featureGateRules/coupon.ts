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
  tables: [
    "coupons",
    "coupon_histories",
    "coupon_attribution_rewards",
    "coupon_issuer_grants",
  ],
  enabled: () => APP_FEATURES.marketing.coupon.enabled,
};
