// src/domains/core/userLoginEvent/plugs/expiryRules/userLoginEventPrune.ts
// 増設点 expiryRules の項目: ログインの記録(user_login_events)を行ごとの保持日数が過ぎたら消す。個人情報の削除
// 今の削除 user-login-event-prune(services/server/pruning.ts の pruneExpiredUserLoginEvents) と同じ行を消す(旧 cron は区切り expiry-retire-crons まで残る。二重に消しても同じ)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "user_login_events",
  key: "id",
  rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" },
  pii: true,
};
