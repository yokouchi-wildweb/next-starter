// src/app/api/cron/user-login-event-prune/task.ts
// 期限切れログインイベント (user_login_events) を定期削除する — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "user-login-event-prune",
  description: "retention_days を過ぎたログインイベント（user_login_events、IP を含む）を削除する",
  schedule: "30 18 * * *", // 毎日 03:30 JST
  run: async () => {
    const { pruneExpiredUserLoginEvents } = await import("@/features/core/userLoginEvent/services/server");
    return await pruneExpiredUserLoginEvents();
  },
};
