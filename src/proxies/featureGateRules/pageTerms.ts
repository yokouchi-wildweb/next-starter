// src/proxies/featureGateRules/pageTerms.ts
// upstream の画面のスイッチ: 利用規約

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/terms"],
  enabled: () => APP_FEATURES.pages.legal.terms,
};
