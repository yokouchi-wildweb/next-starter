// src/app/api/cron/wallet-expiration-notice/route.ts
// ウォレット失効通知（失効予告 + 失効時の本通知）を送る cron タスク
// 本体・頻度・有効条件は src/registry/cronTaskRegistry.ts（スケジュール登録は不要。dispatcher が起動する）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronTaskRoute } from "@/lib/cron";
import { getCronTask } from "@/registry/cronTaskRegistry";

export const maxDuration = 300;

export const GET = createCronTaskRoute(getCronTask("wallet-expiration-notice"));
