// src/domains/core/purchaseRequest/services/server/completion/index.ts
// 購入完了戦略の公開口。戦略の追加: <ドメイン>/plugs/purchaseRequestCompletionStrategies/<名前>.ts に export const strategy → pnpm generate extensions

export { getPurchaseCompletionStrategy, getRegisteredPurchaseTypes } from "./strategyRegistry";
export type { PurchaseCompletionStrategy, CompletionContext, CompletionResult, InitiationValidationContext, LifecycleContext, FailureContext, CallbackUrlContext, CallbackUrls } from "./types";
