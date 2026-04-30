// src/app/api/cron/audit-log-prune/route.ts
// 期限切れ監査ログ (audit_logs) を定期削除する cron タスク
//
// 各行の retention_days を尊重し、期限を過ぎた行のみ削除する。
// バッチ + SKIP LOCKED で進めるため、書き込み tx の長時間ブロッキングは発生しない。
//
// 推奨スケジュール: 1日1回（深夜帯）
//   0 3 * * *
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { pruneExpiredAuditLogs } from "@/features/core/auditLog/services/server";

export const GET = createCronRoute({
  name: "audit-log-prune",
  handler: async () => {
    const result = await pruneExpiredAuditLogs();
    return result;
  },
});
