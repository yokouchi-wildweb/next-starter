// src/domains/core/messaging/scripts/migrations/merge-dispatch-vars.test.ts
// 送信の値をまとめる移行の SQL の確かめ
// 実行: pnpm test src/domains/core/messaging/scripts/migrations/merge-dispatch-vars.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { COLUMN_EXISTS_SQL, MERGE_SQL, task } from "./merge-dispatch-vars";

test("まとめる移行: 値のある行だけ vars に重ね、同じ文で embedded_values を空にする(冪等)、列が無ければ何もしない", () => {
  assert.equal(task.name, "messaging:merge-dispatch-vars");
  assert.equal(task.notice, "20261122-134000-messaging-records");
  assert.match(COLUMN_EXISTS_SQL, /table_name = 'message_dispatches' AND column_name = 'embedded_values'/);
  assert.match(MERGE_SQL, /SET vars = COALESCE\(vars, '\{\}'::jsonb\) \|\| embedded_values, embedded_values = NULL/);
  assert.match(MERGE_SQL, /WHERE embedded_values IS NOT NULL$/);
});
