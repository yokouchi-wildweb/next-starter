// src/app/api/cron/dispatch/[cadence]/route.ts
// 登録済みの定期タスクを頻度区分（15m / hourly / daily / all）ごとにまとめて起動する dispatcher
// スケジューラ（vercel.json）にはこのルートだけを登録する（pnpm cron:generate --plan hobby|pro が生成）。
// タスク一覧は src/registry/cronTaskRegistry.ts（+ fork の forkCronTaskRegistry.ts）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronDispatchRoute } from "@/lib/cron";
import { CRON_TASKS } from "@/registry/cronTaskRegistry";

export const maxDuration = 300;

export const GET = createCronDispatchRoute({ tasks: CRON_TASKS });
