// src/app/api/cron/paired-device-pairings-prune/task.ts
// 期限切れのペアリング（登録端末のペアリングコード）を定期削除する — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm generate cron がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "paired-device-pairings-prune",
  description: "期限切れから 24 時間たったペアリングコード（device_pairings）を削除する",
  schedule: "50 18 * * *", // 毎日 03:50 JST
  // 機能の入切は書かない: 住所 /api/cron/paired-device-pairings-prune を規則 pairedDevice の pathPatterns が閉じる（src/featureGate/rules/pairedDevice.ts、src/lib/cron/README.md「機能の門」）
  run: async () => {
    const { pruneExpiredDevicePairings } = await import(
      "@/features/pairedDevice/services/server"
    );
    return await pruneExpiredDevicePairings();
  },
};
