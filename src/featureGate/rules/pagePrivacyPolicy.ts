// src/featureGate/rules/pagePrivacyPolicy.ts
// upstream の画面のスイッチ: プライバシーポリシー

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/privacy-policy"],
  defaultEnabled: true,
};
