// src/features/core/purchaseRequest/services/server/completion/strategyRegistry.ts
// 購入完了戦略の読み手(項目: ./strategies/<名前>[.<fork の名前>].ts の export const strategy、一覧は生成物)
//
// 同じ type が複数あると例外。ビルトインを差し替えたい fork は上流へ 1 行スイッチを依頼する。

import type { PurchaseTypeKey } from "@/config/app/purchaseType.config";
import { completionStrategies } from "@/features/core/purchaseRequest/extensions/completionStrategies";
import type { PurchaseCompletionStrategy } from "./types";

let memo: Map<PurchaseTypeKey, PurchaseCompletionStrategy> | null = null;

/** 一覧から Map を組み立てる。同じ type は例外 */
export function buildStrategyMap(items: readonly PurchaseCompletionStrategy[]): Map<PurchaseTypeKey, PurchaseCompletionStrategy> {
  const map = new Map<PurchaseTypeKey, PurchaseCompletionStrategy>();
  for (const strategy of items) {
    if (map.has(strategy.type)) {
      throw new Error(`[PurchaseCompletionStrategy] type "${strategy.type}" が複数あります`);
    }
    map.set(strategy.type, strategy);
  }
  return map;
}

// 読み込みの途中(循環 import)で一覧を触らないよう、初回の呼び出しで組み立てる
function strategyMap(): Map<PurchaseTypeKey, PurchaseCompletionStrategy> {
  memo ??= buildStrategyMap(completionStrategies);
  return memo;
}

/**
 * 指定した purchase_type に対応する戦略を取得する
 *
 * 未登録の場合は undefined を返す。呼び出し側で明示的に 400/500 を投げること
 * （サイレント skip するとバグ検知が遅れる）。
 */
export function getPurchaseCompletionStrategy(
  type: PurchaseTypeKey,
): PurchaseCompletionStrategy | undefined {
  return strategyMap().get(type);
}

/**
 * 登録済みの全戦略 type を取得する（デバッグ/管理画面用）
 */
export function getRegisteredPurchaseTypes(): PurchaseTypeKey[] {
  return Array.from(strategyMap().keys());
}
