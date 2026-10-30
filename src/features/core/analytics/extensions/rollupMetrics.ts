// 生成物・編集不可: pnpm extensions:generate が src/features/core/analytics/extensionPoints.ts から生成する
// rollupMetrics: src/features/core/analytics/rollupMetrics/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const metric(並びはファイル名の順)

import type { RollupMetricConfig } from "@/features/core/analytics/services/server/rollup/types";

export const rollupMetrics: RollupMetricConfig[] = [];
