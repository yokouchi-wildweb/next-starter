// src/featureGate/rules/pageTerms.ts
// upstream の画面のスイッチ: 利用規約

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/terms"],
  defaultEnabled: true,
};
