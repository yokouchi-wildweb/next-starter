// src/wiring/cronRoute.ts
//
// cron の route の設定済みの作り手。lib/cron の createCronTaskRoute に門番（@/featureGate の gate.path）を結ぶ。
// src/app/api/cron/<name>/route.ts はここから import する（@/lib/cron の作り手の値 import は wiring だけ: lint cron-route-via-wiring）。
// タスクの住所 /api/cron/<name> が規則の pathPatterns で閉じていれば、本体を呼ばずに skipped（reason "closed"）を返す。
// 設計: src/wiring/README.md, src/lib/cron/README.md

import { gate } from "@/featureGate";
import { createCronTaskRoute as createGenericCronTaskRoute } from "@/lib/cron";
import type { CronTaskDefinition, CronTaskResult } from "@/lib/cron";

const cronRouteDeps = {
  gate: { isClosed: (pathname: string) => !gate.path(pathname).open },
};

/** task.ts のタスク定義から cron の GET ハンドラを作る（門番の判定つき） */
export function createCronTaskRoute<T extends CronTaskResult>(task: CronTaskDefinition<T>) {
  return createGenericCronTaskRoute<T>(task, cronRouteDeps);
}
