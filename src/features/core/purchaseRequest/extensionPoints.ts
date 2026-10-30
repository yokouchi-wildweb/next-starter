// src/features/core/purchaseRequest/extensionPoints.ts
// purchaseRequest の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 購入完了戦略: services/server/completion/strategies/<名前>[.<fork の名前>].ts の export const strategy
  completionStrategies: {
    dir: "services/server/completion/strategies",
    export: "strategy",
    type: { from: "@/features/core/purchaseRequest/services/server/completion/types", name: "PurchaseCompletionStrategy" },
    side: "server",
  },
  // 購入完了ポストフック: services/server/hooks/definitions/<名前>[.<fork の名前>].ts の export const hook(上流の項目は 0)
  completeHooks: {
    dir: "services/server/hooks/definitions",
    export: "hook",
    type: { from: "@/features/core/purchaseRequest/services/server/hooks/purchaseCompleteHookRegistry", name: "PurchaseCompleteHook" },
    side: "server",
  },
};
