// src/featureGate/rules/pageMypage.ts
// upstream の画面のスイッチ: マイページ全体(upstream の画面だけを完全一致で。fork が /mypage の下に足したページは止めない)
// マイページの画面の一部(アカウントの 5 画面・その他の操作)は各規則が pageMypage に dependsOn する(住所は子だけが持つ、D25・D34)。
// 紹介・休会・退会の画面は機能がマイページに依存しないので、両方に依存する小さな機能 mypageInvite・mypagePause・mypageWithdraw が持つ(L3.2)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "=/mypage",
  ],
  enabled: () => APP_FEATURES.pages.mypage,
};
