// 生成物・編集不可: pnpm generate extensions が src/domains/core/purchaseRequest/extensionPoints.ts から生成する
// completionStrategies: src/domains/core/purchaseRequest/services/server/completion/strategies/<名前>.ts(x) か <名前>/index.ts(x) の export const strategy(並びはファイル名の順)

import type { PurchaseCompletionStrategy } from "@/domains/core/purchaseRequest/services/server/completion/types";

import { strategy as completionStrategies_walletTopup } from "@/domains/core/purchaseRequest/services/server/completion/strategies/walletTopup";

export const completionStrategies: PurchaseCompletionStrategy[] = [
  completionStrategies_walletTopup,
];
