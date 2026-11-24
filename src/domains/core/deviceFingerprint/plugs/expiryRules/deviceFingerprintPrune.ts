// src/domains/core/deviceFingerprint/plugs/expiryRules/deviceFingerprintPrune.ts
// 増設点 expiryRules の項目: 端末の指紋(device_fingerprints)を行ごとの保持日数が過ぎたら消す(fingerprint_challenges.fingerprint_id は外部キーの set null)。個人情報の削除
// 今の削除 device-fingerprint-prune(services/server/pruning.ts の pruneExpiredDeviceFingerprints) と同じ行を消す(旧 cron は区切り expiry-retire-crons まで残る。二重に消しても同じ)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "device_fingerprints",
  key: "id",
  rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" },
  pii: true,
};
