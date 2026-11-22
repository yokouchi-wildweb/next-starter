// src/domains/core/purchaseRequest/extensionPoints.ts
// purchaseRequest の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 購入完了戦略: <ドメイン>/plugs/purchaseRequestCompletionStrategies/<名前>.ts の export const strategy
  purchaseRequestCompletionStrategies: {
    change: "add",
    plugs: true,
    export: "strategy",
    type: { from: "@/domains/core/purchaseRequest/services/server/completion/types", name: "PurchaseCompletionStrategy" },
    side: "server",
  },
  // 購入完了ポストフック: <ドメイン>/plugs/purchaseRequestCompleteHooks/<名前>.ts の export const hook(上流の項目は 0)
  purchaseRequestCompleteHooks: {
    change: "add",
    plugs: true,
    export: "hook",
    type: { from: "@/domains/core/purchaseRequest/services/server/hooks/purchaseCompleteHookRegistry", name: "PurchaseCompleteHook" },
    side: "server",
  },
  // 差替点: 1 行スイッチ sessionEnricher(fork は隣に <名前>.replace を作りスイッチを向け替える)
  sessionEnricher: {
    change: "replace",
    default: "src/domains/core/purchaseRequest/services/server/payment/sessionEnricher.default.ts",
    type: { from: "@/domains/core/purchaseRequest/services/server/payment/sessionEnricherTypes", name: "PaymentSessionEnricher" },
    side: "server",
  },
};
