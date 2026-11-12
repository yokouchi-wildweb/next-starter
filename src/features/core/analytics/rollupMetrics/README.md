# rollupMetrics(日次ロールアップのメトリクスの受け口)

`<名前>.ts` に `export const metric: RollupMetricConfig` を置き、`pnpm generate extensions`。上流の項目 = 連絡の日まとめ `messaging<Measure>.ts` の 11 本（中身は `services/server/messagingAnalytics/rollup.ts`）。
書き方: `src/features/core/analytics/README.md`「日次ロールアップ」/ 仕組み: `scripts/structure/extensions/README.md`
