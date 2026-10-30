// src/features/core/batchJob/extensionPoints.ts
// batchJob の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // バッチジョブハンドラ: jobHandlers/<名前>[.<fork の名前>].ts の export const jobHandler
  jobHandlers: {
    dir: "jobHandlers",
    export: "jobHandler",
    type: { from: "@/features/core/batchJob/types", name: "BatchJobHandlerItem" },
    side: "server",
    alwaysOn: true,
  },
};
