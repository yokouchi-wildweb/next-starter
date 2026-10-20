// src/app/api/cron/wallet-lots-prune/task.ts
// 消費し尽くしたウォレットロット（remaining = 0）を定期削除する — cron タスク定義（頻度・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";
import { getExpirationEnabledWalletTypes } from "@/features/core/wallet/utils/expiration";

export const cronTask: CronTaskDefinition = {
  name: "wallet-lots-prune",
  description: "消費し尽くしたウォレットロット（remaining = 0）を保持期間経過後に削除する",
  cadence: "daily",
  enabled: () => getExpirationEnabledWalletTypes().length > 0,
  run: async () => {
    const { pruneConsumedWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/pruneConsumedLots"
    );
    return await pruneConsumedWalletLots();
  },
};
