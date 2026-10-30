// src/proxies/featureGateRules/referral.ts
// マーケティング > 紹介

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/mypage/invite",
    "/api/referral",
    "/api/admin/referral",
  ],
  enabled: () => APP_FEATURES.marketing.referral.enabled,
};
