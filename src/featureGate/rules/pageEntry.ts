// src/featureGate/rules/pageEntry.ts
// upstream の画面のスイッチ: 特設ページ

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/entry"],
  defaultEnabled: false,
};
