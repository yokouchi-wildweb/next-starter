// src/featureGate/rules/pageMypageAccountProfile.ts
// upstream の画面のスイッチ: マイページ > アカウント > プロフィール

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  // マイページの画面の一部(マイページを閉じれば一緒に閉じる)
  dependsOn: ["pageMypage"],
  pathPatterns: ["=/mypage/account/profile"],
  defaultEnabled: true,
};
