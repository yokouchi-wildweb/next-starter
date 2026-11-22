// src/wiring/cronRoute.ts
//
// cron の route の設定済みの作り手。lib/cron の createCronTaskRoute に門番（@/featureGate の gate.path）とメンテナンスの判定
// (点 cronMaintenance の項目、上流は setting。生成された一覧 src/wiring/cron.ts)を結ぶ。
// src/app/api/cron/<name>/route.ts はここから import する（@/lib/cron の作り手の値 import は wiring だけ: lint cron-route-via-wiring）。
// タスクの住所 /api/cron/<name> が門番で閉じていれば（task が読むドメインのどれかが閉、生成一覧の cronTasks。規則の手書きの住所も）、本体を呼ばずに skipped（reason "closed"）を返す。
// 設計: src/wiring/README.md, src/lib/cron/README.md

import { gate } from "@/featureGate";
import { createCronTaskRoute as createGenericCronTaskRoute } from "@/lib/cron";
import type { CreateCronRouteDeps, CronTaskDefinition, CronTaskResult } from "@/lib/cron";
import { cronMaintenance } from "@/wiring/cron";
import { serverErrorReport } from "@/wiring/serverErrorReport";

// メンテナンスの判定(0〜1 個)。空ならメンテナンスで飛ばさない
const maintenancePlug = gate.plugs(cronMaintenance)[0]?.plug;

const cronRouteDeps: CreateCronRouteDeps = {
  gate: { isClosed: (pathname: string) => !gate.path(pathname).open },
  // メンテナンス中は task.ts で maintenance: "pass" を宣言したタスクだけ走る(判定は API・画面と同じ isMaintenanceActive)
  ...(maintenancePlug ? { maintenance: maintenancePlug.deps } : {}),
  // 失敗したタスクはサーバーの失敗の記録へ(既定の 1 行 + fork の送り先。src/lib/serverErrorReport/README.md)
  onServerError: (error, input) =>
    serverErrorReport.report(error, {
      scope: "cron",
      path: input.path,
      method: input.method,
      headers: input.headers,
      requestId: input.requestId,
      name: input.name,
      extra: { ok: false, durationMs: input.durationMs },
    }),
};

/** task.ts のタスク定義から cron の GET ハンドラを作る（門番とメンテナンスの判定つき） */
export function createCronTaskRoute<T extends CronTaskResult>(task: CronTaskDefinition<T>) {
  return createGenericCronTaskRoute<T>(task, cronRouteDeps);
}
