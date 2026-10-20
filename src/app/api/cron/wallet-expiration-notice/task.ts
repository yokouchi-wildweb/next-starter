// src/app/api/cron/wallet-expiration-notice/task.ts
// ウォレット失効通知（失効予告 + 失効時の本通知）を送る — cron タスク定義（頻度・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";
import { hasAnyExpirationNoticeConfig } from "@/features/core/wallet/utils/expiration";

export const cronTask: CronTaskDefinition = {
  name: "wallet-expiration-notice",
  description: "ウォレットの失効予告・失効時の本通知をメール / サービス内通知で送る",
  cadence: "hourly",
  enabled: hasAnyExpirationNoticeConfig,
  run: async () => {
    const { sendWalletExpirationNotices } = await import(
      "@/features/core/wallet/services/server/notification/sendWalletExpirationNotices"
    );
    return await sendWalletExpirationNotices();
  },
};
