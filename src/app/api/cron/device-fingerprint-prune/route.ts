// src/app/api/cron/device-fingerprint-prune/route.ts
// 期限切れフィンガープリント (device_fingerprints) を定期削除する cron タスク
//
// 各行の retention_days を尊重し、期限を過ぎた行のみ削除する。
// バッチ + SKIP LOCKED で進めるため、書き込み tx の長時間ブロッキングは発生しない。
//
// 推奨スケジュール: 1日1回 (深夜帯)
//   15 4 * * *  (他の prune 系 cron と被らない時刻を推奨)
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス (src/lib/cron/auth.ts 参照)

import { createCronRoute } from "@/lib/cron";
import { pruneExpiredDeviceFingerprints } from "@/features/core/deviceFingerprint/services/server";

export const GET = createCronRoute({
  name: "device-fingerprint-prune",
  handler: async () => {
    const result = await pruneExpiredDeviceFingerprints();
    return result;
  },
});
