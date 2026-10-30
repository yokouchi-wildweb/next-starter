// src/proxies/featureGateRules/pageMypageAccountPhone.ts
// upstream の画面のスイッチ: マイページ > アカウント > 電話番号

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["=/mypage/account/phone"],
  enabled: () => APP_FEATURES.pages.mypageAccount.phone,
};
