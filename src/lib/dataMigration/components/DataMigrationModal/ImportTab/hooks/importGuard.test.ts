// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importGuard.test.ts — pnpm test src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importGuard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { importUnsavedGuard } from "./importGuard";

test("取り込み: 取り込み中の間だけ「処理の途中」で守り、終われば外す。guardUnsaved = false なら守らない", () => {
  assert.deepEqual(importUnsavedGuard({ isImporting: true, guardUnsaved: true }), { when: true, reason: "inProgress" });
  assert.deepEqual(importUnsavedGuard({ isImporting: false, guardUnsaved: true }), { when: false, reason: "inProgress" });
  assert.equal(importUnsavedGuard({ isImporting: true, guardUnsaved: false }).when, false);
});
