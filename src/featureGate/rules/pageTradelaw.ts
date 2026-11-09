// src/featureGate/rules/pageTradelaw.ts
// upstream の画面のスイッチ: 特商法表記

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/tradelaw"],
  defaultEnabled: true,
};
