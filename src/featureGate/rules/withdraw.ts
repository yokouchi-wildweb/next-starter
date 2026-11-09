// src/featureGate/rules/withdraw.ts
// 退会(API。退会の画面は mypageWithdraw.ts)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/auth/withdraw",
  ],
  enabled: () => APP_FEATURES.user.withdrawEnabled,
};
