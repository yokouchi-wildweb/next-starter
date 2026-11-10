// src/app/api/cron/messaging-retention/task.ts
// 連絡の記録の保持の掃除 — cron タスク定義（実行時刻・呼ぶ関数）
// 処理本体はドメイン側（messaging/services/server/sweep/retention.ts）。日数は messaging の config
// 機能の門は持たない（messaging の README「cron」）

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "messaging-retention",
  description: "連絡の事件・配達・送信の記録を保持の日数で消す（消す送信の冪等の鍵は残す）",
  schedule: "45 18 * * *", // 毎日 03:45 JST
  run: async () => {
    const { pruneMessagingRecords } = await import("@/features/core/messaging/services/server/sweep");
    return await pruneMessagingRecords();
  },
};
