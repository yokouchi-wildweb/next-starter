// src/featureGate/rules/messagingAnalytics.ts
// 分析 × 連絡: 連絡の集計の API(親 analytics の住所の下。paymentAnalytics / walletAnalytics と同じ形)。
// 連絡そのものは閉じる機能を持たないので dependsOn は analytics だけ。測る物の開閉(計測 messagingTracking・回の管理
// messagingDispatches)は集計の関数が自分で確かめる(開封・クリックは null、回ごとは空)。
// enabled は書かない(入切の既定は開、analytics が開のとき開)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["analytics"],
  pathPatterns: [
    "/api/admin/analytics/messaging",
  ],
  defaultEnabled: true,
};
