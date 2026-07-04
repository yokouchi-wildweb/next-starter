// src/app/api/cron/interaction-event-prune/route.ts
// 期限切れインタラクションイベント (interaction_events) を定期削除する cron タスク
//
// 各行の retention_days を尊重し、期限を過ぎた明細行のみ削除する。
// 集計カウンタ (interaction_counters) は対象外のため、合計値は変わらない。
// バッチ + SKIP LOCKED で進めるため、書き込み tx の長時間ブロッキングは発生しない。
//
// 推奨スケジュール: 1日1回（深夜帯）
//   30 3 * * *
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { pruneExpiredInteractionEvents } from "@/features/core/interactionTracking/services/server";

export const GET = createCronRoute({
  name: "interaction-event-prune",
  handler: async () => {
    const result = await pruneExpiredInteractionEvents();
    return result;
  },
});
