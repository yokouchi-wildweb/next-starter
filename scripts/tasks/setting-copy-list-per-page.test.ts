// scripts/tasks/setting-copy-list-per-page.test.ts
// 移行の task の SQL の確かめ(移行の側に置く: src は scripts を読まない、D78。もとは setting の settingStorage.test.ts の 1 件)
// 実行: pnpm test:setting
import assert from "node:assert/strict";
import { test } from "node:test";

import { COLUMN_EXISTS_SQL, COPY_SQL, VERIFY_SQL, task } from "./setting-copy-list-per-page";

test("写す task: 既にあるキーを書き換えない、一致の確かめ、列が無ければ何もしない", () => {
  assert.equal(task.name, "setting-copy-list-per-page");
  assert.match(COPY_SQL, /WHERE NOT \(COALESCE\(extended, '\{\}'::jsonb\) \? 'adminListPerPage'\)/);
  assert.match(VERIFY_SQL, /IS DISTINCT FROM admin_list_per_page::text/);
  assert.match(COLUMN_EXISTS_SQL, /admin_list_per_page/);
});
