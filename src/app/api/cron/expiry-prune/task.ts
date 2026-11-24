// src/app/api/cron/expiry-prune/task.ts
// 期限の削除 — cron タスク定義（実行時刻・呼ぶ関数）
// 処理本体は lib/cron の runExpiryRules(増設点 expiryRules の項目を順に消す)、結び(門番・本物の表・予算の締切)は src/wiring/expiryPrune.ts。vercel.json のエントリは pnpm generate cron が生成する
// 機能の門は持たない: 閉じたドメインの項目は結びが門番で外す。項目が 0 ならすぐ skipped

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "expiry-prune",
  description: "期限の削除の規則(増設点 expiryRules の項目)ごとに、期限を過ぎた行を予算の内で束ごとに消す(1 本だけ、前回の続きから)",
  schedule: "50 18 * * *", // 毎日 03:50 JST(18:05〜18:50 UTC の各削除の後)
  run: async () => {
    const [{ runExpiryPrune }, { getCheckpoint, advanceCheckpoint }] = await Promise.all([
      import("@/wiring/expiryPrune"),
      import("@/domains/cronCheckpoint/services/server"),
    ]);
    return await runExpiryPrune({ checkpoint: { get: getCheckpoint, advance: advanceCheckpoint } });
  },
};
