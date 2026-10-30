// src/proxies/featureGateRules/withdraw.ts
// 退会(画面と API)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/mypage/withdraw",
    "/api/auth/withdraw",
  ],
  enabled: () => APP_FEATURES.user.withdrawEnabled,
};
