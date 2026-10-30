// src/app/api/cron/wallet-expire-lots/task.ts
// 有効期限切れウォレットロットの残額を没収する — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import { APP_FEATURES } from "@/config/app/app-features.config";
import type { CronTaskDefinition } from "@/lib/cron";
import { getSweepEnabledWalletTypes } from "@/features/core/wallet/utils/expiration";

export const cronTask: CronTaskDefinition = {
  name: "wallet-expire-lots",
  description: "有効期限切れウォレットロットの残額を没収する（sweepEnabled の通貨のみ）",
  schedule: "35 18 * * *", // 毎日 03:35 JST
  // ウォレット無効時はテーブルが無い場合がある（src/proxies/featureGateRules/）
  enabled: () => APP_FEATURES.wallet.enabled && getSweepEnabledWalletTypes().length > 0,
  run: async () => {
    const { sweepExpiredWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/sweepExpiredLots"
    );
    return await sweepExpiredWalletLots();
  },
};
