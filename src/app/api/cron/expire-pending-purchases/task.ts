// src/app/api/cron/expire-pending-purchases/task.ts
// 期限切れ pending 購入リクエストを expired に遷移する定期タスク — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm generate cron がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "expire-pending-purchases",
  description: "期限切れの pending 購入リクエストを expired に遷移する（onExpire フックの副次テーブル掃除を含む）",
  schedule: "*/15 * * * *", // 15 分ごと
  // 機能の入切は書かない: 住所 /api/cron/expire-pending-purchases を規則 payment の pathPatterns が閉じる（src/featureGate/rules/payment.ts、src/lib/cron/README.md「機能の門」）
  run: async () => {
    const { expirePendingRequests } = await import(
      "@/features/core/purchaseRequest/services/server/wrappers/purchaseService"
    );
    const expired = await expirePendingRequests();
    return { expired };
  },
};
