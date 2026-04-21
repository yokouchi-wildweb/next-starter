// src/features/core/purchaseRequest/services/server/completion/index.ts
// 購入完了戦略のエントリポイント
//
// purchaseService.ts がこのファイルを副作用インポートすることで、
// ビルトイン戦略（wallet_topup）の登録が実行される。
//
// 下流プロジェクトで独自戦略を追加する場合:
// 1. 戦略定義ファイルを新規作成（例: completion/directSaleStrategy.ts）
// 2. このファイルで副作用インポート: `import "./directSaleStrategy";`
//    または明示的に registerPurchaseCompletionStrategy() を呼ぶ

import { registerPurchaseCompletionStrategy } from "./strategyRegistry";
import { walletTopupStrategy } from "./walletTopupStrategy";

// ビルトイン戦略の登録
registerPurchaseCompletionStrategy(walletTopupStrategy);

export { registerPurchaseCompletionStrategy, getPurchaseCompletionStrategy, getRegisteredPurchaseTypes } from "./strategyRegistry";
export type { PurchaseCompletionStrategy, CompletionContext, CompletionResult, InitiationValidationContext } from "./types";
