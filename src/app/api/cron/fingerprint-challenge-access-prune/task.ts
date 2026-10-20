// src/app/api/cron/fingerprint-challenge-access-prune/task.ts
// 期限切れのチャレンジアクセスイベント (fingerprint_challenge_access_events) を定期削除する — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "fingerprint-challenge-access-prune",
  description: "retention_days を過ぎたチャレンジ閲覧イベント（IP + UA）を削除する",
  schedule: "15 18 * * *", // 毎日 03:15 JST
  run: async () => {
    const { pruneExpiredChallengeAccessEvents } = await import(
      "@/features/core/fingerprintChallenge/services/server"
    );
    return await pruneExpiredChallengeAccessEvents();
  },
};
