// src/featureGate/rules/withdraw.ts
// 退会(API。退会の画面は mypageWithdraw.ts)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/account-lifecycle/withdraw",
  ],
  defaultEnabled: true,
};
