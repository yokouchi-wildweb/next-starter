// src/app/api/cron/messaging-subscribers/route.ts
// 連絡の購読の cron タスク
// 頻度・呼ぶ関数は同じフォルダの task.ts（vercel.json は pnpm generate cron が生成する）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronTaskRoute } from "@/wiring/cronRoute";
import { cronTask } from "./task";

export const maxDuration = 300;

export const GET = createCronTaskRoute(cronTask);
