// src/app/api/cron/analytics-rollup-daily/route.ts
// 日次メトリクスロールアップ (analytics_daily_rollups) を計算する cron タスク
//
// analyticsRollupRegistry に登録された全メトリクスについて
// 「昨日 + 直近数日」を冪等に再計算する（遅延到着データと実行漏れの自己修復込み）。
// 当日の部分バケットは書き込まず、読み取り側がライブ計算でマージする。
//
// 推奨スケジュール: 1日1回（日付確定後の深夜帯）
//   15 0 * * *
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { runDailyRollup } from "@/features/core/analytics/services/server/rollup";

export const GET = createCronRoute({
  name: "analytics-rollup-daily",
  handler: async () => {
    const result = await runDailyRollup();
    return result;
  },
});
