// src/proxies/featureGateRules/pagePrivacyPolicy.ts
// upstream の画面のスイッチ: プライバシーポリシー

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/privacy-policy"],
  enabled: () => APP_FEATURES.pages.legal.privacyPolicy,
};
