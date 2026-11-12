// src/app/api/cron/messaging-subscribers/task.ts
// 連絡の購読 — cron タスク定義（実行時刻・呼ぶ関数）
// 処理本体はドメイン側（messaging/services/server/subscribers）。vercel.json のエントリは pnpm generate cron がこのファイルから生成する
// 機能の門は持たない: 購読(messaging/subscribers の項目)が 0 なら何もせずに終わる

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "messaging-subscribers",
  description: "連絡の事件(送った・失敗・止めた・回を閉じた・provider の事件)を購読ごとの印から入った順に渡す(少なくとも 1 回、失敗は隔離)",
  schedule: "*/5 * * * *", // 5 分ごと（--plan hobby では 1 日 1 回になる: 遅れるだけで壊れない）
  run: async () => {
    const { runMessageSubscribers } = await import("@/features/core/messaging/services/server/subscribers");
    return await runMessageSubscribers();
  },
};
