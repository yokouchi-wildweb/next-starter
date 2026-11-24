// src/domains/core/fingerprintChallenge/plugs/expiryRules/fingerprintChallengeAccessPrune.ts
// 増設点 expiryRules の項目: 確かめの閲覧の記録(fingerprint_challenge_access_events)を行ごとの保持日数が過ぎたら消す(親の確かめの数は残る)。個人情報の削除
// 今の削除 fingerprint-challenge-access-prune(services/server/pruning.ts の pruneExpiredChallengeAccessEvents) と同じ行を消す(旧 cron は区切り expiry-retire-crons まで残る。二重に消しても同じ)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "fingerprint_challenge_access_events",
  key: "id",
  rule: { kind: "rowDays", column: "accessed_at", daysColumn: "retention_days" },
  pii: true,
};
