// src/features/core/interactionTracking/config.ts
// インタラクション計測の設定(既定 + 上書き)。上書きは src/config/features/interactionTracking.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig

import override from "@/config/features/interactionTracking.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type InteractionTrackingConfig = {
  /**
   * カウンタ行のシャード数。
   * 人気ターゲットへの同時クリックによる単一カウンタ行のロック競合を
   * 1/N に分散する。読み取りは shard を SUM するため値の意味は変わらない。
   * 注意: 減らしても既存 shard 行は残る（SUM が拾うため合計は正しいまま）
   */
  counterShardCount: number;
  /**
   * イベント明細（interaction_events）の既定保持日数。
   * 集計カウンタ・日次集計は prune 対象外のため、合計値と時系列はこの期間を超えて保持される
   */
  defaultRetentionDays: number;
  /**
   * 日次集計（interaction_daily_counters）の日界タイムゾーン。
   * 「どの時刻までを同じ1日と数えるか」の基準。analytics ドメインの既定と揃える
   */
  aggregationTimeZone: string;
};

const defaults: InteractionTrackingConfig = {
  counterShardCount: 8,
  defaultRetentionDays: 365,
  aggregationTimeZone: "Asia/Tokyo",
};

export const interactionTrackingConfigDef = defineConfig(defaults, { label: "interactionTracking" });

/** 上書きのファイルの型(`export default { ... } satisfies InteractionTrackingOverride`) */
export type InteractionTrackingOverride<E extends object = Record<never, never>> = OverrideOf<typeof interactionTrackingConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const interactionTrackingConfig: InteractionTrackingConfig = interactionTrackingConfigDef.compose(override);
