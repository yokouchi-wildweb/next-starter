// 生成物・編集不可: pnpm generate extensions が src/domains/core/analytics/extensionPoints.ts から生成する
// analyticsCoinIssuanceSources: 差す側の <ドメイン>/plugs/analyticsCoinIssuanceSources/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const source(並びは<差す側>/<名前> の順、常に読む: gate.plugs を掛けず項目の enabled で閉じる)

import type { CoinIssuanceSource } from "@/domains/core/analytics/services/server/coinIssuance/types";

import { source as analyticsCoinIssuanceSources_analytics_purchaseBonusGap } from "@/domains/core/analytics/plugs/analyticsCoinIssuanceSources/purchaseBonusGap";
import { source as analyticsCoinIssuanceSources_analytics_walletBonusGrant } from "@/domains/core/analytics/plugs/analyticsCoinIssuanceSources/walletBonusGrant";

export const analyticsCoinIssuanceSources: { domain: string | null; name: string; requires: readonly string[]; plug: CoinIssuanceSource }[] = [
  { domain: "analytics", name: "purchaseBonusGap", requires: [], plug: analyticsCoinIssuanceSources_analytics_purchaseBonusGap },
  { domain: "analytics", name: "walletBonusGrant", requires: [], plug: analyticsCoinIssuanceSources_analytics_walletBonusGrant },
];
