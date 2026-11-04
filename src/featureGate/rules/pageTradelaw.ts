// src/featureGate/rules/pageTradelaw.ts
// upstream の画面のスイッチ: 特商法表記

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/tradelaw"],
  enabled: () => APP_FEATURES.pages.legal.tradelaw,
};
