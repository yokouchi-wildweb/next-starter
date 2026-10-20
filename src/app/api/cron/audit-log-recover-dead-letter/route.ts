// src/app/api/cron/audit-log-recover-dead-letter/route.ts
// audit_logs_failed (dead-letter) に退避された行の再投入を定期実行する cron タスク
// 頻度・有効条件・呼ぶ関数は同じフォルダの task.ts（vercel.json は pnpm cron:generate が生成する）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronTaskRoute } from "@/lib/cron";
import { cronTask } from "./task";

export const GET = createCronTaskRoute(cronTask);
