// src/features/core/setting/scripts/migrations/merge-maintenance-keys.test.ts
// 移行の task の SQL の確かめ(DB に触らない。移行の側に置く: src は scripts を読まない)
// 実行: pnpm test src/features/core/setting/scripts/migrations/merge-maintenance-keys.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { DROP_SQL, MERGE_SQL, VERIFY_SQL, task } from "./merge-maintenance-keys";

test("まとめる task: 古い 3 キーを maintenance へ、既にある行は古いキーを消すだけ、残りを確かめる", () => {
  assert.equal(task.name, "setting:merge-maintenance-keys");
  assert.ok(task.notice);
  assert.match(MERGE_SQL, /jsonb_build_object\('maintenance', jsonb_build_object\('enabled', COALESCE\(extended->'maintenanceEnabled', 'false'::jsonb\)/);
  assert.match(MERGE_SQL, /'startAt', COALESCE\(extended->'maintenanceStartAt', 'null'::jsonb\)/);
  assert.match(MERGE_SQL, /'endAt', COALESCE\(extended->'maintenanceEndAt', 'null'::jsonb\)/);
  assert.match(MERGE_SQL, /AND NOT \(COALESCE\(extended, '\{\}'::jsonb\) \? 'maintenance'\)/);
  assert.match(DROP_SQL, /AND extended \? 'maintenance'$/);
  for (const sql of [MERGE_SQL, DROP_SQL]) assert.match(sql, /- 'maintenanceEnabled' - 'maintenanceStartAt' - 'maintenanceEndAt'/);
  assert.match(VERIFY_SQL, /\?\| ARRAY\['maintenanceEnabled', 'maintenanceStartAt', 'maintenanceEndAt'\]/);
});
