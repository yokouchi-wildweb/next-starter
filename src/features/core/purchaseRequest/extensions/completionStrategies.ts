// 生成物・編集不可: pnpm extensions:generate が src/features/core/purchaseRequest/extensionPoints.ts から生成する
// completionStrategies: src/features/core/purchaseRequest/services/server/completion/strategies/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const strategy(並びはファイル名の順)

import type { PurchaseCompletionStrategy } from "@/features/core/purchaseRequest/services/server/completion/types";

import { strategy as walletTopup } from "@/features/core/purchaseRequest/services/server/completion/strategies/walletTopup";

export const completionStrategies: PurchaseCompletionStrategy[] = [
  walletTopup,
];
