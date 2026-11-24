// src/domains/core/auditLog/plugs/expiryRules/auditLogPrune.ts
// 増設点 expiryRules の項目: 監査ログ(audit_logs)を行ごとの保持日数(retention_days、記録の時に決まる)が過ぎたら消す。個人情報の削除(fork の上書きで止められない)
// 今の削除 audit-log-prune(services/server/pruning.ts の pruneExpiredAuditLogs) と同じ行を消す(旧 cron は区切り expiry-retire-crons まで残る。二重に消しても同じ)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "audit_logs",
  key: "id",
  rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" },
  pii: true,
};
