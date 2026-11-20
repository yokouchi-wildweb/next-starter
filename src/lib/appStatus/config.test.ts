// src/lib/appStatus/config.test.ts
// appStatus の設定の上書きが効くことと、1 回の応答から起きたことを決める関数のテスト。実行: pnpm test src/lib/appStatus (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { appStatusConfig, appStatusConfigDef } from "./config";
import { resolveAppStatusEvent } from "./resolveAppStatusEvent";

// 上流の既定は compose({}) で見る(読み込んだ appStatusConfig は fork が src/config/lib/appStatus.config.ts に書いた値で変わる)
test("上流の空の上書きでは既定のまま、読み込んだ設定(@lib-config/appStatus)も同じキー", () => {
  assert.deepEqual(Object.keys(appStatusConfig).sort(), Object.keys(appStatusConfigDef.compose({})).sort());
  assert.deepEqual(appStatusConfigDef.compose({}), {
    healthPath: "/api/health",
    maintenancePath: "/maintenance",
    intervalMs: 30_000,
  });
});

test("上書きの値が効き、上書きの無いキーは既定のまま", () => {
  const config = appStatusConfigDef.compose({ maintenancePath: "/closed", intervalMs: 60_000 });
  assert.equal(config.maintenancePath, "/closed");
  assert.equal(config.intervalMs, 60_000);
  assert.equal(config.healthPath, "/api/health");
});

const status = (buildId: string, active = false, bypassed = false) => ({ buildId, maintenance: { active, bypassed } });

test("止められるメンテナンスだけが maintenance(bypass できる viewer は止めない)", () => {
  assert.equal(resolveAppStatusEvent(status("a", true, false), "a"), "maintenance");
  assert.equal(resolveAppStatusEvent(status("a", true, true), "a"), "none");
});

test("最初の 1 回は基準にするだけ、その後に buildId が変わると newDeploy", () => {
  assert.equal(resolveAppStatusEvent(status("a"), null), "none");
  assert.equal(resolveAppStatusEvent(status("a"), "a"), "none");
  assert.equal(resolveAppStatusEvent(status("b"), "a"), "newDeploy");
});
