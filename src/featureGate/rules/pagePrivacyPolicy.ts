// src/featureGate/rules/pagePrivacyPolicy.ts
// upstream の画面のスイッチ: プライバシーポリシー

import { LEGAL_CONFIG } from "@/features/legal/config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/privacy-policy"],
  enabled: () => LEGAL_CONFIG.pages.privacyPolicy,
};
