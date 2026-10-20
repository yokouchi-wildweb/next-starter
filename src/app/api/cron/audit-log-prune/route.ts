// src/app/api/cron/audit-log-prune/route.ts
// 期限切れ監査ログ (audit_logs) を定期削除する cron タスク
// 本体・頻度・有効条件は src/registry/cronTaskRegistry.ts（スケジュール登録は不要。dispatcher が起動する）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronTaskRoute } from "@/lib/cron";
import { getCronTask } from "@/registry/cronTaskRegistry";

export const GET = createCronTaskRoute(getCronTask("audit-log-prune"));
