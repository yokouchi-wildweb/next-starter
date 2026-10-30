// src/features/core/purchaseRequest/services/server/completion/strategyRegistry.ts
// 購入完了戦略の読み手(項目: ./strategies/<名前>[.<fork の名前>].ts の export const strategy、一覧は生成物)
//
// 同じ type が複数あると後の項目(ファイル名の順)が勝つ(warn)。ビルトインを差し替えるなら
// ファイル名が後ろに来る名前で置く(例: zWalletTopup.<fork の名前>.ts)。

import type { PurchaseTypeKey } from "@/config/app/purchaseType.config";
import { completionStrategies } from "@/features/core/purchaseRequest/extensions/completionStrategies";
import type { PurchaseCompletionStrategy } from "./types";

let memo: Map<PurchaseTypeKey, PurchaseCompletionStrategy> | null = null;

// 読み込みの途中(循環 import)で一覧を触らないよう、初回の呼び出しで組み立てる
function strategyMap(): Map<PurchaseTypeKey, PurchaseCompletionStrategy> {
  if (memo) return memo;
  const map = new Map<PurchaseTypeKey, PurchaseCompletionStrategy>();
  for (const strategy of completionStrategies) {
    if (map.has(strategy.type)) {
      console.warn(`[PurchaseCompletionStrategy] type "${strategy.type}" が複数あります。後の項目で上書きします。`);
    }
    map.set(strategy.type, strategy);
  }
  memo = map;
  return map;
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
