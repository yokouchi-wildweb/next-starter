// src/domains/core/setting/scripts/migrations/copy-list-per-page.test.ts
// 移行の task の SQL の確かめ(移行の側に置く: src は scripts を読まない、D78。もとは setting の settingStorage.test.ts の 1 件)
// 実行: pnpm test src/domains/core/setting/scripts/migrations/copy-list-per-page.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { TaskRerunnableError } from "@/lib/task";

import { COLUMN_EXISTS_SQL, COPY_SQL, KEPT_SQL, MISSING_SQL, task, verdictOf } from "./copy-list-per-page";

test("写す task: 既にあるキーを書き換えない、一致の確かめ、列が無ければ何もしない", () => {
  assert.equal(task.name, "setting:copy-list-per-page");
  assert.match(COPY_SQL, /WHERE NOT \(COALESCE\(extended, '\{\}'::jsonb\) \? 'adminListPerPage'\)/);
  assert.match(MISSING_SQL, /WHERE NOT \(COALESCE\(extended, '\{\}'::jsonb\) \? 'adminListPerPage'\)/);
  assert.match(KEPT_SQL, /\? 'adminListPerPage' AND .*IS DISTINCT FROM admin_list_per_page::text/);
  assert.match(COLUMN_EXISTS_SQL, /admin_list_per_page/);
});

test("写した後の判定: キーの無い行が残れば打ち直せる失敗、尊重した行(kept)だけなら成功", () => {
  assert.deepEqual(verdictOf({ copied: 3, missing: 0, kept: 2 }), { copied: 3, missing: 0, kept: 2 });
  assert.throws(() => verdictOf({ copied: 3, missing: 1, kept: 0 }), (error) => error instanceof TaskRerunnableError && error.result?.missing === 1);
});
