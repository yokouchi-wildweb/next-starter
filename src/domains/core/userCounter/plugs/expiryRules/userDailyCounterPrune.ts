// src/domains/core/userCounter/plugs/expiryRules/userDailyCounterPrune.ts
// 増設点 expiryRules の項目: 利用者ごとの日の数(user_daily_counters)を行ごとの保持日数が過ぎたら消す(累計の表は残る)。個人情報の削除
// 消す行: date + retention_days * 1 日 < 今(保持日数は加算の時に行へ書く: 設定 defaultRetentionDays)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "user_daily_counters",
  key: "id",
  rule: { kind: "rowDays", column: "date", daysColumn: "retention_days" },
  pii: true,
};
