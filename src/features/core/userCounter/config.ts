// src/features/core/userCounter/config.ts
// per-user カウンタ（userCounter）の設定(既定 + 上書き)。上書きは src/config/features/userCounter.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig

import override from "@/config/features/userCounter.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type UserCounterConfig = {
  /**
   * 日次カウンタ（user_daily_counters）の既定保持日数。
   * ユーザー日次はユーザー数 × 日数に比例して増えるため、
   * コンテンツ軸の日次集計（永久保持）と違い保持期限を設ける。
   * 累計カウンタ（user_counters）は prune 対象外のため、合計値は期限を超えて保持される
   */
  defaultRetentionDays: number;
  /**
   * 日次カウンタの日界タイムゾーン。
   * 「どの時刻までを同じ1日と数えるか」の基準。interactionTracking / analytics と揃える
   */
  dailyTimeZone: string;
};

const defaults: UserCounterConfig = {
  defaultRetentionDays: 730,
  dailyTimeZone: "Asia/Tokyo",
};

export const userCounterConfigDef = defineConfig(defaults, { label: "userCounter" });

/** 上書きのファイルの型(`export default { ... } satisfies UserCounterOverride`) */
export type UserCounterOverride<E extends object = Record<never, never>> = OverrideOf<typeof userCounterConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const userCounterConfig: UserCounterConfig = userCounterConfigDef.compose(override);
