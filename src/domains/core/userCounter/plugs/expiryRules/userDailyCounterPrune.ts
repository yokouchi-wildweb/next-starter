// src/domains/core/userCounter/plugs/expiryRules/userDailyCounterPrune.ts
// 増設点 expiryRules の項目: 利用者ごとの日の数(user_daily_counters)を行ごとの保持日数が過ぎたら消す(累計の表は残る)。個人情報の削除
// 今の削除 user-daily-counter-prune(services/server/pruning.ts の pruneExpiredUserDailyCounters) と同じ行を消す(旧 cron は区切り expiry-retire-crons まで残る。二重に消しても同じ)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "user_daily_counters",
  key: "id",
  rule: { kind: "rowDays", column: "date", daysColumn: "retention_days" },
  pii: true,
};
