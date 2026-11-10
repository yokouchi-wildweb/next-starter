// src/featureGate/rules/couponAttributionReward.ts
// 紹介の報酬(クーポンの帰属報酬: 使われたクーポンの持ち主にウォレットの報酬を付ける台帳と本人の閲覧)。D29
// クーポンの機能から外した自分の機能。報酬の付与はウォレットへの加算なので wallet にだけ dependsOn(コードはクーポンの型しか読まない)。
// enabled は書かない(条件なし、ウォレットが開のとき開。クーポンのフラグは読まない、L3.3)。報酬だけを閉じるなら defaultEnabled か fork の switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["wallet"],
  pathPatterns: [
    "/api/me/coupon-attribution-rewards",
  ],
  domains: [
    "core/couponAttributionReward",
  ],
  defaultEnabled: true,
};
