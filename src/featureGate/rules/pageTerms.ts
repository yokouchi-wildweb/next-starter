// src/featureGate/rules/pageTerms.ts
// upstream の画面のスイッチ: 利用規約

import { LEGAL_CONFIG } from "@/features/legal/config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/terms"],
  enabled: () => LEGAL_CONFIG.pages.terms,
};
