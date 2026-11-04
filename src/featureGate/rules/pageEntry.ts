// src/featureGate/rules/pageEntry.ts
// upstream の画面のスイッチ: 特設ページ

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/entry"],
  enabled: () => APP_FEATURES.pages.entry,
};
