// src/lib/mediaInputSuite/components/uploadFailure.test.ts
// 失敗した枠の判定のテスト。実行: pnpm test:media-upload-failure
import assert from "node:assert/strict";
import { test } from "node:test";

import { hasFailedUpload } from "./uploadFailure";

test("失敗した枠があれば true、外せば false", () => {
  const failed = { kind: "error", canceled: false };
  assert.equal(hasFailedUpload([{ kind: "uploaded" }, failed]), true);
  assert.equal(hasFailedUpload([{ kind: "uploaded" }]), false);
});

test("利用者が中止した枠・アップロード中の枠は失敗に数えない", () => {
  assert.equal(hasFailedUpload([{ kind: "error", canceled: true }]), false);
  assert.equal(hasFailedUpload([{ kind: "uploading" }]), false);
  assert.equal(hasFailedUpload([]), false);
});
