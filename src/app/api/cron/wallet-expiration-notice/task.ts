// src/app/api/cron/wallet-expiration-notice/task.ts
// ウォレット失効通知（失効予告 + 失効時の本通知）を送る — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm generate cron がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";
import { hasAnyExpirationNoticeConfig } from "@/features/core/wallet/utils/expiration";

export const cronTask: CronTaskDefinition = {
  name: "wallet-expiration-notice",
  description: "ウォレットの失効予告・失効時の本通知をメール / サービス内通知で送る",
  schedule: "15 * * * *", // 毎時 15 分
  // 機能の入切は書かない: 住所 /api/cron/wallet-expiration-notice を規則 wallet の pathPatterns が閉じる（src/featureGate/rules/wallet.ts、src/lib/cron/README.md「機能の門」）
  // 追加の条件: 失効予告・本通知の設定を持つ通貨があるときだけ
  enabled: () => hasAnyExpirationNoticeConfig(),
  run: async () => {
    const { sendWalletExpirationNotices } = await import(
      "@/features/core/wallet/services/server/notification/sendWalletExpirationNotices"
    );
    return await sendWalletExpirationNotices();
  },
};
