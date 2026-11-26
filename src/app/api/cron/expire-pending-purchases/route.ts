// src/app/api/cron/expire-pending-purchases/route.ts
// 期限切れの購入リクエストを片付ける定期タスク(pending は expired へ、期限を過ぎた client_sdk の processing は決済プロバイダと照らしてから閉じる)
// 頻度・有効条件・呼ぶ関数は同じフォルダの task.ts（vercel.json は pnpm generate cron が生成する）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronTaskRoute } from "@/wiring/cronRoute";
import { cronTask } from "./task";

export const GET = createCronTaskRoute(cronTask);
