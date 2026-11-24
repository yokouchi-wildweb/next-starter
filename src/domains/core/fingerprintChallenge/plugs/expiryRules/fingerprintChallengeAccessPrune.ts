// src/domains/core/fingerprintChallenge/plugs/expiryRules/fingerprintChallengeAccessPrune.ts
// 増設点 expiryRules の項目: 確かめの閲覧の記録(fingerprint_challenge_access_events)を行ごとの保持日数が過ぎたら消す(親の確かめの数は残る)。個人情報の削除
// 消す行: accessed_at + retention_days * 1 日 < 今(保持日数は記録の時に設定 challenge.accessLog.retentionDays から行へ書く)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "fingerprint_challenge_access_events",
  key: "id",
  rule: { kind: "rowDays", column: "accessed_at", daysColumn: "retention_days" },
  pii: true,
};
