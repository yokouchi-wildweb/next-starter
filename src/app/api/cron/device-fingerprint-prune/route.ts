// src/app/api/cron/device-fingerprint-prune/route.ts
// 期限切れフィンガープリント (device_fingerprints) を定期削除する cron タスク
// 頻度・有効条件・呼ぶ関数は同じフォルダの task.ts（vercel.json は pnpm cron:generate が生成する）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronTaskRoute } from "@/lib/cron";
import { cronTask } from "./task";

export const GET = createCronTaskRoute(cronTask);
