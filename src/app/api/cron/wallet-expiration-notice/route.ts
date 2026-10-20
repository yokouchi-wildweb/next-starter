// src/app/api/cron/wallet-expiration-notice/route.ts
// ウォレット失効通知（失効予告 + 失効時の本通知）を送る cron タスク
// 頻度・有効条件・呼ぶ関数は同じフォルダの task.ts（vercel.json は pnpm cron:generate が生成する）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronTaskRoute } from "@/lib/cron";
import { cronTask } from "./task";

export const maxDuration = 300;

export const GET = createCronTaskRoute(cronTask);
