// src/app/api/cron/device-fingerprint-prune/task.ts
// 期限切れフィンガープリント (device_fingerprints) を定期削除する — cron タスク定義（頻度・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "device-fingerprint-prune",
  description: "retention_days を過ぎたデバイスフィンガープリント（device_fingerprints）を削除する",
  cadence: "daily",
  run: async () => {
    const { pruneExpiredDeviceFingerprints } = await import("@/features/core/deviceFingerprint/services/server");
    return await pruneExpiredDeviceFingerprints();
  },
};
