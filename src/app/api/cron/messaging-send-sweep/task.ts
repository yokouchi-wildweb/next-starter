// src/app/api/cron/messaging-send-sweep/task.ts
// 連絡の送信の掃き出し — cron タスク定義（実行時刻・呼ぶ関数）
// 処理本体はドメイン側（messaging/services/server/sweep）。vercel.json のエントリは pnpm generate cron がこのファイルから生成する
// 機能の門は持たない: 送る口と同じく常に開（messaging の README「cron」）

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "messaging-send-sweep",
  description: "連絡の配達の続き（予約・大きな送信の展開・送り直し・残りの束）を送り、終えた送信を閉じる",
  schedule: "* * * * *", // 毎分（--plan hobby では 1 日 1 回になる: 遅れるだけで壊れない）
  run: async () => {
    const { runSendSweep } = await import("@/features/core/messaging/services/server/sweep");
    return await runSendSweep();
  },
};
