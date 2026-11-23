// 状態のまとめての変更の束の結果をまとめる関数(./bulkStatusChunks.ts)の検査
// 実行: pnpm test src/domains/core/user/utils/bulkStatusChunks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeBulkStatusResults } from "./bulkStatusChunks";

test("束の結果を束の順につなぐ(形は API の結果と同じ)", () => {
  const merged = mergeBulkStatusResults(
    [
      { dryRun: true, changed: [{ userId: "u1", from: "active" }], skipped: [], failed: [] },
      { dryRun: true, changed: [{ userId: "u3", from: "inactive" }], skipped: [{ userId: "u2", why: "既にその状態" }], failed: [{ userId: "u4", error: "x" }] },
    ],
    true,
  );
  assert.deepEqual(merged, {
    dryRun: true,
    changed: [
      { userId: "u1", from: "active" },
      { userId: "u3", from: "inactive" },
    ],
    skipped: [{ userId: "u2", why: "既にその状態" }],
    failed: [{ userId: "u4", error: "x" }],
  });
});

test("束 0(空の結果)は空のまとめ", () => {
  assert.deepEqual(mergeBulkStatusResults([], false), { dryRun: false, changed: [], skipped: [], failed: [] });
});
