// src/proxies/featureGateRules/mypageOther.ts
// その他の操作(休会・退会の入口。どちらも無効なら中身が無い)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["/mypage/other"],
  enabled: () => APP_FEATURES.user.pauseEnabled || APP_FEATURES.user.withdrawEnabled,
};
