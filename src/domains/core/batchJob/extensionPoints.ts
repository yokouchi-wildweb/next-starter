// src/domains/core/batchJob/extensionPoints.ts
// batchJob の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // バッチジョブハンドラ: <ドメイン>/plugs/batchJobJobHandlers/<名前>.ts の export const jobHandler
  batchJobJobHandlers: {
    change: "add",
    plugs: true,
    export: "jobHandler",
    type: { from: "@/domains/core/batchJob/types", name: "BatchJobHandlerItem" },
    side: "server",
    alwaysOn: true,
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
