// src/features/core/wallet/scripts/tasks/reverse-history.test.ts — pnpm test src/features/core/wallet/scripts/tasks
// wallet:reverse-history の引数の読み方と止める鍵(DB を使わない)。DB での動きは services/server/wrappers/reverseHistory.db.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { readReverseHistoryArgs, reverseHistoryStopKeys } from "./lib.reverseHistoryArgs";
import { task } from "./reverse-history";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("--history: 複数の id、--reason 必須、--dry-run を読む", () => {
  assert.deepEqual(readReverseHistoryArgs(["--history", `${A},${B}`, "--reason", "付与の誤り", "--dry-run"]), {
    historyIds: [A, B],
    reason: "付与の誤り",
    dryRun: true,
  });
  assert.deepEqual(readReverseHistoryArgs([`--history=${A}`, "--reason=x"]), { historyIds: [A], reason: "x", dryRun: false });
});

test("--batch: request_batch_id を読む", () => {
  assert.deepEqual(readReverseHistoryArgs(["--batch", B, "--reason", "一括の誤り"]), { requestBatchId: B, reason: "一括の誤り", dryRun: false });
});

test("止める(TaskNotStartedError): どちらも無い・両方・理由なし・uuid でない・重なり・空", () => {
  const notStarted = (args: string[], why: RegExp) =>
    assert.throws(() => readReverseHistoryArgs(args), (error: Error) => error.name === "TaskNotStartedError" && why.test(error.message));
  notStarted(["--reason", "x"], /どちらか一方/);
  notStarted(["--history", A, "--batch", B, "--reason", "x"], /どちらか一方/);
  notStarted(["--history", A], /--reason/);
  notStarted(["--history", A, "--reason", "--dry-run"], /--reason/);
  notStarted(["--history", "abc", "--reason", "x"], /uuid です: abc/);
  notStarted(["--history", `${A},${A}`, "--reason", "x"], /重なっています/);
  notStarted(["--history", ",", "--reason", "x"], /id がありません/);
  notStarted(["--batch", "nope", "--reason", "x"], /request_batch_id/);
});

test("止める鍵: 行ごとに wallet-reverse:<id>。--history は DB を読まずに鍵を返す", async () => {
  assert.deepEqual(reverseHistoryStopKeys([A, B]), [`wallet-reverse:${A}`, `wallet-reverse:${B}`]);
  assert.equal(task.name, "wallet:reverse-history");
  assert.deepEqual(await task.stopKeys?.(["--history", A, "--reason", "x"]), [`wallet-reverse:${A}`]);
});
