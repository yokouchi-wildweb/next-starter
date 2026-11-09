// src/featureGate/rules/paymentAnalytics.ts
// 分析 × 決済: 購入の集計の API(親 analytics × 子 payment の小さな機能、D34 K3)。
// 住所は親の住所の下にあるが、子の機能は親に依存しないので、両方に依存するこの機能が住所を持つ。
// enabled は書かない(省略 = 自分は開、両方が開のとき開)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["analytics", "payment"],
  pathPatterns: [
    "/api/admin/analytics/purchase",
  ],
};
