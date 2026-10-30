// src/app/api/cron/paired-device-pairings-prune/task.ts
// 期限切れのペアリング（登録端末のペアリングコード）を定期削除する — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import { PAIRED_DEVICE_CONFIG } from "@/config/app/paired-device.config";
import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "paired-device-pairings-prune",
  description: "期限切れから 24 時間たったペアリングコード（device_pairings）を削除する",
  schedule: "50 18 * * *", // 毎日 03:50 JST
  // 登録端末が無効のときはテーブルが無い（src/proxies/featureGateRules/）
  enabled: () => PAIRED_DEVICE_CONFIG.enabled,
  run: async () => {
    const { pruneExpiredDevicePairings } = await import(
      "@/features/core/pairedDevice/services/server"
    );
    return await pruneExpiredDevicePairings();
  },
};
