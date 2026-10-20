// src/app/api/cron/interaction-event-prune/task.ts
// 期限切れインタラクションイベント (interaction_events) を定期削除する — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "interaction-event-prune",
  description: "保持期限を過ぎた interactionTracking のイベント明細を削除する（累計・日次集計は残る）",
  schedule: "20 18 * * *", // 毎日 03:20 JST
  run: async () => {
    const { pruneExpiredInteractionEvents } = await import("@/features/core/interactionTracking/services/server");
    return await pruneExpiredInteractionEvents();
  },
};
