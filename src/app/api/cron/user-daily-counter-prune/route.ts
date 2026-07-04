// src/app/api/cron/user-daily-counter-prune/route.ts
// 期限切れの per-user 日次カウンタ (user_daily_counters) を定期削除する cron タスク
//
// 各行の retention_days を尊重し、期限を過ぎた日次行のみ削除する。
// 累計カウンタ (user_counters) は対象外のため、合計値は変わらない。
// バッチ + SKIP LOCKED で進めるため、書き込み tx の長時間ブロッキングは発生しない。
//
// 推奨スケジュール: 1日1回（深夜帯）
//   45 3 * * *
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { pruneExpiredUserDailyCounters } from "@/features/core/userCounter/services/server/pruning";

export const GET = createCronRoute({
  name: "user-daily-counter-prune",
  handler: async () => {
    const result = await pruneExpiredUserDailyCounters();
    return result;
  },
});
