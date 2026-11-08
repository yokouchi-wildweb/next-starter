// src/featureGate/rules/pageTradelaw.ts
// upstream の画面のスイッチ: 特商法表記

import { LEGAL_CONFIG } from "@/features/legal/config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/tradelaw"],
  enabled: () => LEGAL_CONFIG.pages.tradelaw,
};
