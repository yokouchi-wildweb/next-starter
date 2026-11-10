// src/featureGate/rules/pageServices.ts
// upstream の画面のスイッチ: サービス紹介

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/services"],
  defaultEnabled: false,
};
