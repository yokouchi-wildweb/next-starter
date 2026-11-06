// src/app/api/cron/wallet-lots-prune/task.ts
// 消費し尽くしたウォレットロット（remaining = 0）を定期削除する — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm generate cron がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";
import { getExpirationEnabledWalletTypes } from "@/features/core/wallet/utils/expiration";

export const cronTask: CronTaskDefinition = {
  name: "wallet-lots-prune",
  description: "消費し尽くしたウォレットロット（remaining = 0）を保持期間経過後に削除する",
  schedule: "40 18 * * *", // 毎日 03:40 JST（wallet-expire-lots の後）
  // 機能の入切は書かない: 住所 /api/cron/wallet-lots-prune を規則 wallet の pathPatterns が閉じる（src/featureGate/rules/wallet.ts、src/lib/cron/README.md「機能の門」）
  // 追加の条件: 有効期限を有効にした通貨があるときだけ
  enabled: () => getExpirationEnabledWalletTypes().length > 0,
  run: async () => {
    const { pruneConsumedWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/pruneConsumedLots"
    );
    return await pruneConsumedWalletLots();
  },
};
