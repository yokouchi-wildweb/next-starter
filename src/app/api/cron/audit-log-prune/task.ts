// src/app/api/cron/audit-log-prune/task.ts
// 期限切れ監査ログ (audit_logs) を定期削除する — cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "audit-log-prune",
  description: "retention_days を過ぎた監査ログ（audit_logs）をバッチ削除する",
  schedule: "5 18 * * *", // 毎日 03:05 JST
  run: async () => {
    const { pruneExpiredAuditLogs } = await import("@/features/core/auditLog/services/server");
    return await pruneExpiredAuditLogs();
  },
};
