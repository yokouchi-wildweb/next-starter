// src/app/api/cron/expire-pending-purchases/route.ts
// 期限切れ pending 購入リクエストを expired に遷移する定期タスク
// 頻度・有効条件・呼ぶ関数は同じフォルダの task.ts（vercel.json は pnpm cron:generate が生成する）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronTaskRoute } from "@/lib/cron";
import { cronTask } from "./task";

export const GET = createCronTaskRoute(cronTask);
