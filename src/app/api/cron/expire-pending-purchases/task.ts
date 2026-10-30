// src/app/api/cron/expire-pending-purchases/task.ts
// 期限切れ pending 購入リクエストを expired に遷移する定期タスク — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import { APP_FEATURES } from "@/config/app/app-features.config";
import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "expire-pending-purchases",
  description: "期限切れの pending 購入リクエストを expired に遷移する（onExpire フックの副次テーブル掃除を含む）",
  schedule: "*/15 * * * *", // 15 分ごと
  // 決済無効時はテーブルが無い場合がある（src/proxies/featureGateRules/）
  enabled: () => APP_FEATURES.payment.enabled,
  run: async () => {
    const { expirePendingRequests } = await import(
      "@/features/core/purchaseRequest/services/server/wrappers/purchaseService"
    );
    const expired = await expirePendingRequests();
    return { expired };
  },
};
