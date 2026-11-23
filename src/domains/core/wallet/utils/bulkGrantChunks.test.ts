// まとめての付与の束の結果をまとめる関数(./bulkGrantChunks.ts)の検査
// 実行: pnpm test src/domains/core/wallet/utils/bulkGrantChunks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import type { BulkGrantResult } from "@/domains/core/wallet/services/types";
import { mergeBulkGrantResults } from "./bulkGrantChunks";

const result = (over: Partial<BulkGrantResult>): BulkGrantResult => ({
  dryRun: false,
  requestBatchId: null,
  granted: [],
  skipped: [],
  total: 0,
  notified: 0,
  notifyFailed: [],
  ...over,
});

test("束の結果をつなぎ、合計と知らせの数を足し、書いた束の requestBatchIds を束の順に持つ", () => {
  const merged = mergeBulkGrantResults(
    [
      result({ requestBatchId: "b1", granted: [{ userId: "u1", amount: 100 }], total: 100, notified: 1 }),
      result({ requestBatchId: "b2", granted: [{ userId: "u3", amount: 50 }], skipped: [{ userId: "u2", why: "削除済み" }], total: 50, notifyFailed: [{ userId: "u3", error: "x" }] }),
    ],
    false,
  );
  assert.deepEqual(merged, {
    dryRun: false,
    requestBatchIds: ["b1", "b2"],
    granted: [{ userId: "u1", amount: 100 }, { userId: "u3", amount: 50 }],
    skipped: [{ userId: "u2", why: "削除済み" }],
    total: 150,
    notified: 1,
    notifyFailed: [{ userId: "u3", error: "x" }],
  });
});

test("dryRun は束が書かないので requestBatchIds が空。1 束なら API の結果と同じ中身", () => {
  const one = result({ dryRun: true, granted: [{ userId: "u1", amount: 10 }], total: 10 });
  const merged = mergeBulkGrantResults([one], true);
  assert.equal(merged.dryRun, true);
  assert.deepEqual(merged.requestBatchIds, []);
  assert.deepEqual(merged.granted, one.granted);
  assert.equal(merged.total, 10);
});
