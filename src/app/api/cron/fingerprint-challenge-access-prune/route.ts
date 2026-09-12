// src/app/api/cron/fingerprint-challenge-access-prune/route.ts
// 期限切れのチャレンジアクセスイベント (fingerprint_challenge_access_events) を定期削除する cron タスク
//
// 各行の retention_days を尊重し、期限を過ぎた行のみ削除する。
// バッチ + SKIP LOCKED で進めるため、書き込み tx の長時間ブロッキングは発生しない。
// 親行のカウンタ (first/last_viewed_at / view_count) は残る (PII を含まない集計値)。
//
// 推奨スケジュール: 1日1回 (深夜帯)
//   20 4 * * *  (他の prune 系 cron と被らない時刻を推奨)
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス (src/lib/cron/auth.ts 参照)

import { createCronRoute } from "@/lib/cron";
import { pruneExpiredChallengeAccessEvents } from "@/features/core/fingerprintChallenge/services/server";

export const GET = createCronRoute({
  name: "fingerprint-challenge-access-prune",
  handler: async () => {
    const result = await pruneExpiredChallengeAccessEvents();
    return result;
  },
});
