// src/app/api/cron/wallet-expire-lots/route.ts
// 有効期限切れウォレットロットの残額を没収する cron タスク
//
// wallet-expiration.config.ts で expirationDays + sweepEnabled が設定された通貨のみ対象。
// 対象通貨がなければ即終了（no-op）するため、未オプトインのプロジェクトでも登録して害はない。
//
// - ウォレット行ロック（SKIP LOCKED）で並走ユーザー消費と衝突しても安全に進行
// - locked_balance を下回る失効は行わず、次回実行に持ち越し
// - 冪等: 何度実行しても二重没収は発生しない
//
// 推奨スケジュール: 1日1回（深夜帯）
//   30 4 * * *
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { sweepExpiredWalletLots } from "@/features/core/wallet/services/server/lots/sweepExpiredLots";

export const GET = createCronRoute({
  name: "wallet-expire-lots",
  handler: async () => {
    const result = await sweepExpiredWalletLots();
    return result;
  },
});
