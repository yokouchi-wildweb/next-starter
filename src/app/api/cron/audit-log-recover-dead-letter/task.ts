// src/app/api/cron/audit-log-recover-dead-letter/task.ts
// audit_logs_failed (dead-letter) に退避された行の再投入を定期実行する — cron タスク定義（頻度・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "audit-log-recover-dead-letter",
  description: "監査ログの dead-letter（audit_logs_failed）を audit_logs へ再投入する",
  cadence: "hourly",
  run: async () => {
    const { recoverDeadLetterAuditLogs } = await import("@/features/core/auditLog/services/server");
    return await recoverDeadLetterAuditLogs();
  },
};
