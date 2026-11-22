// src/features/core/messaging/scripts/migrations/rename-template-vars.test.ts
// 改名の移行の SQL と判断の確かめ
// 実行: pnpm test src/features/core/messaging/scripts/migrations/rename-template-vars.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { TABLES, columnsSql, planRename, renameSql, task } from "./rename-template-vars";

test("改名の移行: 2 つの表、embedded だけある表を改名、済み・無い表は飛ばす、両方ある表は止める", () => {
  assert.equal(task.name, "messaging:rename-template-vars");
  assert.equal(task.notice, "20261122-134000-messaging-records");
  assert.deepEqual([...TABLES], ["message_templates", "message_template_versions"]);
  assert.match(columnsSql("message_templates"), /table_name = 'message_templates' AND column_name IN \('embedded', 'vars'\)/);
  assert.equal(renameSql("message_template_versions"), "ALTER TABLE message_template_versions RENAME COLUMN embedded TO vars");
  assert.equal(planRename(["embedded"]), "rename");
  assert.equal(planRename(["vars"]), "skip");
  assert.equal(planRename([]), "skip");
  assert.equal(planRename(["embedded", "vars"]), "conflict");
});
