// src/proxies/featureGateRules/pageMypageAccountProfile.ts
// upstream の画面のスイッチ: マイページ > アカウント > プロフィール

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/mypage/account/profile"],
  enabled: () => APP_FEATURES.pages.mypageAccount.profile,
};
