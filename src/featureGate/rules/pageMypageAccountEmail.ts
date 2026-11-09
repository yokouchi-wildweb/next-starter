// src/featureGate/rules/pageMypageAccountEmail.ts
// upstream の画面のスイッチ: マイページ > アカウント > メールアドレス

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  // マイページの画面の一部(マイページを閉じれば一緒に閉じる)
  dependsOn: ["pageMypage"],
  pathPatterns: ["=/mypage/account/email"],
  enabled: () => APP_FEATURES.pages.mypageAccount.email,
};
