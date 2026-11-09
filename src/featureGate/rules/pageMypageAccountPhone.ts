// src/featureGate/rules/pageMypageAccountPhone.ts
// upstream の画面のスイッチ: マイページ > アカウント > 電話番号

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  // マイページの画面の一部(マイページを閉じれば一緒に閉じる)
  dependsOn: ["pageMypage"],
  pathPatterns: ["=/mypage/account/phone"],
  defaultEnabled: true,
};
