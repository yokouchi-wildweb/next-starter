// src/features/core/user/scripts/tasks/bulk-change-status.test.ts — pnpm test src/features/core/user/scripts/tasks
// user:bulk-change-status の引数の読み方(DB を使わない)。DB での動きは services/server/wrappers/bulkChangeStatus.db.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { idsOfFileText, readBulkChangeStatusArgs } from "./lib.bulkChangeStatusArgs";
import { task } from "./bulk-change-status";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("--users / --file、--to・--reason 必須、--from・--dry-run を読む", () => {
  assert.deepEqual(readBulkChangeStatusArgs(["--to", "suspended", "--users", `${A},${B}`, "--reason", "規約違反", "--from", "active", "--dry-run"]), {
    userIds: [A, B],
    newStatus: "suspended",
    reason: "規約違反",
    onlyFrom: "active",
    dryRun: true,
  });
  const fromFile = readBulkChangeStatusArgs(["--to=active", "--file", "ids.txt", "--reason=解除"], () => `# 対象\n${A}\n\n${B}\n`);
  assert.deepEqual([fromFile.userIds, fromFile.newStatus, fromFile.onlyFrom, fromFile.dryRun], [[A, B], "active", undefined, false]);
});

test("ファイルの id: 空行と # の行を飛ばす", () => {
  assert.deepEqual(idsOfFileText(`# c\r\n ${A} \r\n\r\n#${B}\n${B}`), [A, B]);
});

test("止める(TaskNotStartedError): --to なし・知らない状態・理由なし・どちらも無い・両方・読めないファイル・空・uuid でない・重なり", () => {
  const notStarted = (args: string[], why: RegExp, read?: (path: string) => string) =>
    assert.throws(() => readBulkChangeStatusArgs(args, read), (error: Error) => error.name === "TaskNotStartedError" && why.test(error.message));
  notStarted(["--users", A, "--reason", "x"], /--to <状態> は必須/);
  notStarted(["--to", "frozen", "--users", A, "--reason", "x"], /--to frozen は知らない状態/);
  notStarted(["--to", "active", "--from", "nope", "--users", A, "--reason", "x"], /--from nope/);
  notStarted(["--to", "active", "--users", A], /--reason/);
  notStarted(["--to", "active", "--reason", "x"], /どちらか一方/);
  notStarted(["--to", "active", "--users", A, "--file", "f", "--reason", "x"], /どちらか一方/);
  notStarted(["--to", "active", "--file", "missing.txt", "--reason", "x"], /を読めません/, () => {
    throw new Error("ENOENT");
  });
  notStarted(["--to", "active", "--file", "f", "--reason", "x"], /id がありません/, () => "# none\n");
  notStarted(["--to", "active", "--users", "abc", "--reason", "x"], /uuid です: abc/);
  notStarted(["--to", "active", "--users", `${A},${A}`, "--reason", "x"], /重なっています/);
});

test("名前と止める鍵: user:bulk-change-status、鍵は無い(打ち直すと変わった人を飛ばす)", () => {
  assert.equal(task.name, "user:bulk-change-status");
  assert.equal(task.stopKeys, undefined);
});
