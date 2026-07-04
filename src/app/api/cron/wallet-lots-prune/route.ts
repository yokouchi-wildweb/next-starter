// src/app/api/cron/wallet-lots-prune/route.ts
// 消費し尽くしたウォレットロット（remaining = 0）を定期削除する cron タスク
//
// 付与のたびにロット行が増えるため、有効期限を有効化した（特に付与頻度が高い）
// プロジェクトでは日次で回して wallet_lots の肥大化を防ぐこと。
// 保持日数: src/config/app/wallet-expiration.config.ts の WALLET_LOT_PRUNE_RETENTION_DAYS
//
// 残高との不変条件・失効スイープ・失効間近照会はいずれも remaining > 0 の行しか
// 参照しないため、この削除が挙動に影響することはない。
//
// 推奨スケジュール: 1日1回（深夜帯）
//   45 4 * * *
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { pruneConsumedWalletLots } from "@/features/core/wallet/services/server/lots/pruneConsumedLots";

export const GET = createCronRoute({
  name: "wallet-lots-prune",
  handler: async () => {
    const result = await pruneConsumedWalletLots();
    return result;
  },
});
