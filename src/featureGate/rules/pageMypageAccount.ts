// src/featureGate/rules/pageMypageAccount.ts
// upstream の画面のスイッチ: マイページ > アカウント

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  // マイページの画面の一部(マイページを閉じれば一緒に閉じる)
  dependsOn: ["pageMypage"],
  pathPatterns: ["=/mypage/account"],
  enabled: () => APP_FEATURES.pages.mypageAccount.top,
};
