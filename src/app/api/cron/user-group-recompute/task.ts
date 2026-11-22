// src/app/api/cron/user-group-recompute/task.ts
// ユーザーグループの定期計算 — cron タスク定義（実行時刻・呼ぶ関数）
// 処理本体はドメイン側（userGroup/services/server/recompute）。vercel.json のエントリは pnpm generate cron がこのファイルから生成する
// 門: このファイルが userGroup のドメインを import するので、生成の一覧の cronTasks に載り、門 userGroups が閉なら門番が飛ばす（pnpm generate cron は vercel.json に載せない）

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "user-group-recompute",
  description: "期限の来た定期計算のユーザーグループの新しい版を予算つきで書き、書き終えたら今の版を一度に切り替える（失敗は理由を残し今の版のまま、古い版は片付ける）",
  schedule: "55 * * * *", // 毎時 55 分（--plan hobby では 1 日 1 回になる: グループの間隔が 1 日より短くても 1 日 1 回）
  run: async () => {
    const { runUserGroupRecompute } = await import("@/domains/core/userGroup/services/server/recompute");
    return await runUserGroupRecompute();
  },
};
