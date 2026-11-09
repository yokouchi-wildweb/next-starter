// src/featureGate/rules/pause.ts
// 休会(API。休会の画面は mypagePause.ts。休会中ユーザーの復帰 /reactivate・/api/auth/reactivate は塞がない:
// 後から無効にしても既に休会中のユーザーが戻れるように。/reactivate 画面は loader 側で判定する)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/auth/pause",
  ],
  defaultEnabled: false,
};
