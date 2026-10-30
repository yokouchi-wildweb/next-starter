// src/proxies/featureGateRules/pageMypageAccountPassword.ts
// upstream の画面のスイッチ: マイページ > アカウント > パスワード

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/mypage/account/password"],
  enabled: () => APP_FEATURES.pages.mypageAccount.password,
};
