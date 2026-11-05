// src/lib/mediaInputSuite/hooks/uploadGuard.test.ts — pnpm test:unsaved-guard
import { test } from "node:test";
import assert from "node:assert/strict";

import { uploadUnsavedGuard } from "./uploadGuard";

test("アップロード: 送信中の間だけ「処理の途中」で守り、済めば外す。guardUnsaved = false なら守らない", () => {
  assert.deepEqual(uploadUnsavedGuard({ uploading: true, guardUnsaved: true }), { when: true, reason: "inProgress" });
  assert.deepEqual(uploadUnsavedGuard({ uploading: false, guardUnsaved: true }), { when: false, reason: "inProgress" });
  assert.equal(uploadUnsavedGuard({ uploading: true, guardUnsaved: false }).when, false);
});
