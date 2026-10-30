// src/proxies/featureGateRules/pageMypageAccount.ts
// upstream の画面のスイッチ: マイページ > アカウント

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/mypage/account"],
  enabled: () => APP_FEATURES.pages.mypageAccount.top,
};
