// src/proxies/featureGateRules/pause.ts
// 休会(画面と API。休会中ユーザーの復帰 /reactivate・/api/auth/reactivate は塞がない:
// 後から無効にしても既に休会中のユーザーが戻れるように。/reactivate 画面は loader 側で判定する)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/mypage/pause",
    "/api/auth/pause",
  ],
  enabled: () => APP_FEATURES.user.pauseEnabled,
};
