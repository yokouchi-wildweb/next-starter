// 生成物・編集不可: pnpm extensions:generate が src/features/core/analytics/extensionPoints.ts から生成する
// coinIssuanceSources: src/features/core/analytics/services/server/coinIssuance/sources/<名前>.ts(x) か <名前>/index.ts(x) の export const source(並びはファイル名の順)

import type { CoinIssuanceSource } from "@/features/core/analytics/services/server/coinIssuance/types";

import { source as coinIssuanceSources_couponAttributionReward } from "@/features/core/analytics/services/server/coinIssuance/sources/couponAttributionReward";
import { source as coinIssuanceSources_purchaseBonusGap } from "@/features/core/analytics/services/server/coinIssuance/sources/purchaseBonusGap";
import { source as coinIssuanceSources_referralReward } from "@/features/core/analytics/services/server/coinIssuance/sources/referralReward";

export const coinIssuanceSources: CoinIssuanceSource[] = [
  coinIssuanceSources_couponAttributionReward,
  coinIssuanceSources_purchaseBonusGap,
  coinIssuanceSources_referralReward,
];
