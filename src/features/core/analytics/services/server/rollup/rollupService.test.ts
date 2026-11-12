// src/features/core/analytics/services/server/rollup/rollupService.test.ts
// 日次 cron の遡る日数の規則の検査(DB なし): max(メトリクスの lookbackDays, 実行の日数)、誤った値は実行の日数
// 実行: pnpm test src/features/core/analytics/services/server/rollup/rollupService.test.ts
import { before, test } from "node:test";
import assert from "node:assert/strict";

let metricLookbackDays: typeof import("./rollupService").metricLookbackDays;
before(async () => {
  ({ metricLookbackDays } = await import("./rollupService"));
});

test("メトリクスの日数が長ければそちら、実行の日数が長ければ実行の日数", () => {
  assert.equal(metricLookbackDays({}, 3), 3);
  assert.equal(metricLookbackDays({ lookbackDays: 30 }, 3), 30);
  assert.equal(metricLookbackDays({ lookbackDays: 7 }, 10), 10);
});

test("正の整数でない lookbackDays は実行の日数(cron を止めない)", () => {
  assert.equal(metricLookbackDays({ lookbackDays: 0 }, 3), 3);
  assert.equal(metricLookbackDays({ lookbackDays: 2.5 }, 3), 3);
  assert.equal(metricLookbackDays({ lookbackDays: -1 }, 3), 3);
});
