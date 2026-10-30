// src/features/core/analytics/extensionPoints.ts
// analytics の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 日次ロールアップのメトリクス: rollupMetrics/<名前>[.<fork の名前>].ts の export const metric(上流の項目は 0)
  rollupMetrics: {
    dir: "rollupMetrics",
    export: "metric",
    type: { from: "@/features/core/analytics/services/server/rollup/types", name: "RollupMetricConfig" },
    side: "server",
    alwaysOn: true,
  },
  // コイン創出サマリーのソース: services/server/coinIssuance/sources/<名前>[.<fork の名前>].ts の export const source
  coinIssuanceSources: {
    dir: "services/server/coinIssuance/sources",
    export: "source",
    type: { from: "@/features/core/analytics/services/server/coinIssuance/types", name: "CoinIssuanceSource" },
    side: "server",
    alwaysOn: true,
  },
};
