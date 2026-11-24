// src/app/api/cron/outbox-dispatch/task.ts
// 送り箱の配達 — cron タスク定義（実行時刻・呼ぶ関数）
// 処理本体はドメイン側（outbox/services/server/dispatch.ts）。vercel.json のエントリは pnpm generate cron がこのファイルから生成する
// 機能の門は持たない: ドメイン outbox を import するので、機能 outbox が閉じている間は住所が閉じ、vercel.json にも載らない

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "outbox-dispatch",
  description: "送り箱の時の来た行を届ける(1 本だけ・予算の内、失敗は指数の間隔で再試行・上限で隔離)、最後に監視のしきい値を比べる",
  schedule: "* * * * *", // 毎分（--plan hobby では 1 日 1 回になる: 押す(after)が先に届け、ここは保証だけ。遅れるだけで壊れない）
  run: async () => {
    const { runOutboxDispatch } = await import("@/domains/core/outbox/services/server");
    const { serverErrorReport } = await import("@/wiring/serverErrorReport");
    return await runOutboxDispatch((error, extra) =>
      serverErrorReport.report(error, { scope: "cron", path: "/api/cron/outbox-dispatch", method: "GET", name: "outbox-dispatch", extra }),
    );
  },
};
