// src/featureGate/rules/mypageOther.ts
// その他の操作(休会・退会の入口。どちらも無効なら中身が無い)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  // マイページの画面の一部(マイページを閉じれば一緒に閉じる)
  dependsOn: ["pageMypage"],
  pathPatterns: ["/mypage/other"],
  enabled: () => APP_FEATURES.user.pauseEnabled || APP_FEATURES.user.withdrawEnabled,
};
