// src/proxies/featureGateRules/pageMypage.ts
// upstream の画面のスイッチ: マイページ全体(upstream の画面だけを完全一致で。fork が /mypage の下に足したページは止めない)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "=/mypage",
    "=/mypage/account",
    "=/mypage/account/email",
    "=/mypage/account/password",
    "=/mypage/account/phone",
    "=/mypage/account/profile",
    "=/mypage/invite",
    "=/mypage/other",
    "=/mypage/pause",
    "=/mypage/withdraw",
  ],
  enabled: () => APP_FEATURES.pages.mypage,
};
