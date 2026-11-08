// src/features/core/analytics/services/server/rollup/rollupRegistry.ts
// 登録済みメトリクスを有効なものと無効なものに分ける（DB に触れない純粋関数。rollupService が生成一覧を渡す）

import { DomainError } from "@/lib/errors";
import type { RollupMetricConfig } from "./types";

export type RollupRegistry = {
  /** 有効なメトリクス（key → 設定、登録順） */
  active: Map<string, RollupMetricConfig>;
  /** enabled() が false のメトリクスの key */
  disabledKeys: Set<string>;
};

/**
 * key の重複は無効なメトリクスも含めて例外（設定ミス。有効・無効が切り替わっても重複の判定は変わらない）。
 * enabled 省略 = 有効。
 */
export function buildRollupRegistry(metrics: readonly RollupMetricConfig[]): RollupRegistry {
  const seen = new Set<string>();
  const active = new Map<string, RollupMetricConfig>();
  const disabledKeys = new Set<string>();
  for (const config of metrics) {
    if (seen.has(config.key)) {
      throw new DomainError(`rollupMetrics に key "${config.key}" が重複登録されています。`, { status: 500 });
    }
    seen.add(config.key);
    if (config.enabled?.() ?? true) active.set(config.key, config);
    else disabledKeys.add(config.key);
  }
  return { active, disabledKeys };
}
