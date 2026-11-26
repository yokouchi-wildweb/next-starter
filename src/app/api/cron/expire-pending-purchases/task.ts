// src/app/api/cron/expire-pending-purchases/task.ts
// 期限切れの購入リクエストを片付ける定期タスク — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// pending は expired へ、client_sdk の processing は決済プロバイダと照らしてから閉じる（払われていれば完了）
// 処理本体はドメイン側。vercel.json のエントリは pnpm generate cron がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "expire-pending-purchases",
  description: "期限切れの pending 購入リクエストを expired に遷移し（onExpire フックの副次テーブル掃除を含む）、期限を過ぎた client_sdk の processing を決済プロバイダと照らして片付ける",
  schedule: "*/15 * * * *", // 15 分ごと
  // 機能の入切は書かない: 住所 /api/cron/expire-pending-purchases を規則 payment の pathPatterns が閉じる（src/featureGate/rules/payment.ts、src/lib/cron/README.md「1. task.ts」）
  run: async () => {
    const { expirePendingRequests, settleExpiredClientSdkSessions } = await import(
      "@/domains/core/purchaseRequest/services/server/wrappers/purchaseService"
    );
    const expired = await expirePendingRequests();
    const settled = await settleExpiredClientSdkSessions();
    return { expired, settled };
  },
};
