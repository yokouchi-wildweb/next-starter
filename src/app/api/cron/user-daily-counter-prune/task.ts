// src/app/api/cron/user-daily-counter-prune/task.ts
// 期限切れの per-user 日次カウンタ (user_daily_counters) を定期削除する — cron タスク定義（頻度・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "user-daily-counter-prune",
  description: "保持期限を過ぎた userCounter の日次行を削除する（累計は残る）",
  cadence: "daily",
  run: async () => {
    const { pruneExpiredUserDailyCounters } = await import("@/features/core/userCounter/services/server/pruning");
    return await pruneExpiredUserDailyCounters();
  },
};
