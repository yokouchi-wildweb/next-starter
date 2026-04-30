// src/app/api/cron/audit-log-recover-dead-letter/route.ts
// audit_logs_failed (dead-letter) に退避された行の再投入を定期実行する cron タスク
//
// bestEffort 記録の失敗は dead-letter に退避され、本タスクで再 INSERT を試みる。
// 恒久的に再投入できない (schema 不整合等) 行はそのまま残るため、
// 件数の長期増加が見られる場合は手動調査が必要。
//
// 推奨スケジュール: 1時間に1回
//   0 * * * *
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { recoverDeadLetterAuditLogs } from "@/features/core/auditLog/services/server";

export const GET = createCronRoute({
  name: "audit-log-recover-dead-letter",
  handler: async () => {
    const result = await recoverDeadLetterAuditLogs();
    return result;
  },
});
