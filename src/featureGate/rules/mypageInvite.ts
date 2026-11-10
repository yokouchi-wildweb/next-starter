// src/featureGate/rules/mypageInvite.ts
// マイページ × 紹介: 招待の画面(親 pageMypage × 子 referral の小さな機能、D34 K3)。
// 住所は親の住所の下にあるが、子の機能は親に依存しないので、両方に依存するこの機能が住所を持つ。
// enabled は書かない(入切の既定は開、両方が開のとき開)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["pageMypage", "referral"],
  pathPatterns: [
    "/mypage/invite",
  ],
  defaultEnabled: true,
};
