// src/domains/core/pairedDevice/plugs/expiryRules/pairedDevicePairingsPrune.ts
// 増設点 expiryRules の項目: 端末のペアリング(device_pairings)を期限(expires_at)から 1 日(= 24 時間)たったら消す
// 今の削除 paired-device-pairings-prune(services/server/pairingService.ts の pruneExpiredDevicePairings、olderThanHours 24) と同じ行を消す(旧 cron は区切り expiry-retire-crons まで残る。二重に消しても同じ)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "device_pairings",
  key: "id",
  rule: { kind: "age", column: "expires_at", days: 1 },
  pii: false,
};
