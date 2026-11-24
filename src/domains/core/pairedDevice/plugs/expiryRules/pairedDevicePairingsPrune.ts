// src/domains/core/pairedDevice/plugs/expiryRules/pairedDevicePairingsPrune.ts
// 増設点 expiryRules の項目: 端末のペアリング(device_pairings)を期限(expires_at)から 1 日(= 24 時間)たったら消す
// 消す行: expires_at < 今 − 1 日(期限切れから 24 時間は残す)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "device_pairings",
  key: "id",
  rule: { kind: "age", column: "expires_at", days: 1 },
  pii: false,
};
