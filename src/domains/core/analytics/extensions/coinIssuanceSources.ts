// 生成物・編集不可: pnpm generate extensions が src/domains/core/analytics/extensionPoints.ts から生成する
// coinIssuanceSources: src/domains/core/analytics/services/server/coinIssuance/sources/<名前>.ts(x) か <名前>/index.ts(x) の export const source(並びはファイル名の順)

import type { CoinIssuanceSource } from "@/domains/core/analytics/services/server/coinIssuance/types";

import { source as coinIssuanceSources_purchaseBonusGap } from "@/domains/core/analytics/services/server/coinIssuance/sources/purchaseBonusGap";
import { source as coinIssuanceSources_walletBonusGrant } from "@/domains/core/analytics/services/server/coinIssuance/sources/walletBonusGrant";

export const coinIssuanceSources: CoinIssuanceSource[] = [
  coinIssuanceSources_purchaseBonusGap,
  coinIssuanceSources_walletBonusGrant,
];
