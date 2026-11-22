// 生成物・編集不可: pnpm generate extensions が src/domains/core/purchaseRequest/extensionPoints.ts から生成する
// purchaseRequestCompletionStrategies: 差す側の <ドメイン>/plugs/purchaseRequestCompletionStrategies/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const strategy(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { PurchaseCompletionStrategy } from "@/domains/core/purchaseRequest/services/server/completion/types";

import { strategy as purchaseRequestCompletionStrategies_wallet_walletTopup } from "@/domains/core/wallet/plugs/purchaseRequestCompletionStrategies/walletTopup";

export const purchaseRequestCompletionStrategies: { domain: string | null; name: string; requires: readonly string[]; plug: PurchaseCompletionStrategy }[] = [
  { domain: "wallet", name: "walletTopup", requires: [], plug: purchaseRequestCompletionStrategies_wallet_walletTopup },
];
