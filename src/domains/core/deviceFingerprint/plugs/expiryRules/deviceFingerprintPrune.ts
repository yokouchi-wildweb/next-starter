// src/domains/core/deviceFingerprint/plugs/expiryRules/deviceFingerprintPrune.ts
// 増設点 expiryRules の項目: 端末の指紋(device_fingerprints)を行ごとの保持日数が過ぎたら消す(fingerprint_challenges.fingerprint_id は外部キーの set null)。個人情報の削除
// 消す行: created_at + retention_days * 1 日 < 今(保持日数は記録の時に行へ書く: 365)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "device_fingerprints",
  key: "id",
  rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" },
  pii: true,
};
