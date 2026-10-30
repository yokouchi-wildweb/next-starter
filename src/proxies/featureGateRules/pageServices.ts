// src/proxies/featureGateRules/pageServices.ts
// upstream の画面のスイッチ: サービス紹介

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/services"],
  enabled: () => APP_FEATURES.pages.services,
};
