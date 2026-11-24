// src/domains/core/userLoginEvent/plugs/expiryRules/userLoginEventPrune.ts
// 増設点 expiryRules の項目: ログインの記録(user_login_events)を行ごとの保持日数が過ぎたら消す。個人情報の削除
// 消す行: created_at + retention_days * 1 日 < 今(保持日数は記録の時に行へ書く: 365)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "user_login_events",
  key: "id",
  rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" },
  pii: true,
};
