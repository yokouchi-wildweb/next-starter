// src/proxies/featureGateRules/pageMypageAccountEmail.ts
// upstream の画面のスイッチ: マイページ > アカウント > メールアドレス

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/mypage/account/email"],
  enabled: () => APP_FEATURES.pages.mypageAccount.email,
};
