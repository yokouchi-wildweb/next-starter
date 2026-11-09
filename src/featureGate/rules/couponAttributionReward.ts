// src/featureGate/rules/couponAttributionReward.ts
// 紹介の報酬(クーポンの帰属報酬: 使われたクーポンの持ち主にウォレットの報酬を付ける台帳と本人の閲覧)。D29
// クーポンの機能から外した自分の機能。報酬の付与はウォレットへの加算なので wallet にだけ dependsOn(コードはクーポンの型しか読まない)。
// enabled は書かない(省略 = 自分は開、ウォレットが開のとき開。クーポンのフラグは読まない、L3.3)。報酬だけを閉じる値は入切の値の移動で規則の既定に置く

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["wallet"],
  pathPatterns: [
    "/api/me/coupon-attribution-rewards",
  ],
  features: [
    "core/couponAttributionReward",
  ],
};
