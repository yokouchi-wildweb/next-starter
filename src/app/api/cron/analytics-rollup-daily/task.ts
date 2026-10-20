// src/app/api/cron/analytics-rollup-daily/task.ts
// 日次メトリクスロールアップ (analytics_daily_rollups) を計算する — cron タスク定義（頻度・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "analytics-rollup-daily",
  description: "登録済みメトリクスの日次ロールアップを直近数日ぶん冪等に再計算する",
  cadence: "daily",
  run: async () => {
    const { runDailyRollup } = await import("@/features/core/analytics/services/server/rollup");
    return await runDailyRollup();
  },
};
