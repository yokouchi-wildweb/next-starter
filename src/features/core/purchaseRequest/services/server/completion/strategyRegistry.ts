// src/features/core/purchaseRequest/services/server/completion/strategyRegistry.ts
// 購入完了戦略レジストリ
//
// paymentProvider / purchaseCompleteHook と同じ「レジストリ + 副作用インポート登録」パターン。
// ビルトイン戦略（wallet_topup）は completion/index.ts で登録される。
// 下流プロジェクトは registerPurchaseCompletionStrategy() で独自戦略を追加できる。
//
// 使い方（下流プロジェクト）:
// ```ts
// import { registerPurchaseCompletionStrategy } from "@/features/core/purchaseRequest/...";
// registerPurchaseCompletionStrategy({
//   type: "direct_sale",
//   validateInitiation: async ({ params }) => { ... },
//   complete: async ({ purchaseRequest, tx }) => {
//     // 在庫減算等のカスタム処理
//     return { walletHistory: null };
//   },
// });
// ```

import type { PurchaseTypeKey } from "@/config/app/purchaseType.config";
import type { PurchaseCompletionStrategy } from "./types";

const strategies = new Map<PurchaseTypeKey, PurchaseCompletionStrategy>();

/**
 * 戦略を登録する
 *
 * 同じ type で再登録すると上書きされる（warn）。
 * 下流プロジェクトでビルトイン戦略を差し替えたい場合にも利用可能。
 */
export function registerPurchaseCompletionStrategy(strategy: PurchaseCompletionStrategy): void {
  if (strategies.has(strategy.type)) {
    console.warn(
      `[PurchaseCompletionStrategy] type "${strategy.type}" は既に登録されています。上書きします。`,
    );
  }
  strategies.set(strategy.type, strategy);
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
  return strategies.get(type);
}

/**
 * 登録済みの全戦略 type を取得する（デバッグ/管理画面用）
 */
export function getRegisteredPurchaseTypes(): PurchaseTypeKey[] {
  return Array.from(strategies.keys());
}
