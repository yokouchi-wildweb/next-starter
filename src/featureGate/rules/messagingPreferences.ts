// src/featureGate/rules/messagingPreferences.ts
// 連絡の好み(種類 × 経路の配信停止)のページ /mypage/account/notifications と本人の API /api/me/messaging/preferences(D35・D45)。
// 閉の間、ページと API は 404。メールの本文の配信停止のリンクは開の時だけこのページを指し、閉ならワンクリックの URL のまま。
// ワンクリックの受け口 /api/messaging/unsubscribe と表 message_preferences は門に関わらず開(送る側が好みを読むため)なので domains は持たない。
// マイページの画面の一部(マイページを閉じれば一緒に閉じる)。入切の既定は閉。fork が開ける値は src/config/featureGate/switches.config.ts
// 住所は messaging の constants/preferences.ts と同じ値

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["pageMypage"],
  pathPatterns: [
    "/mypage/account/notifications",
    "/api/me/messaging/preferences",
  ],
  domains: [],
  defaultEnabled: false,
};
