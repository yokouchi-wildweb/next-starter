// src/domains/core/auditLog/plugs/expiryRules/auditLogPrune.ts
// 増設点 expiryRules の項目: 監査ログ(audit_logs)を行ごとの保持日数(retention_days、記録の時に決まる)が過ぎたら消す。個人情報の削除(fork の上書きで止められない)
// 消す行: created_at + retention_days * 1 日 < 今(保持日数は記録の時に行へ書く: 既定 365、ログインの監査 90)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "audit_logs",
  key: "id",
  rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" },
  pii: true,
};
