// src/features/core/wallet/scripts/tasks/bulk-grant.test.ts — pnpm test src/features/core/wallet/scripts/tasks
// wallet:bulk-grant の引数の読み方と止める鍵(DB を使わない)。DB での動きは services/server/wrappers/bulkGrant.db.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { bulkGrantStopKey, linesOfGrantFile, readBulkGrantArgs } from "./lib.bulkGrantArgs";
import { task } from "./bulk-grant";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const base = ["--wallet-type", "regular_coin", "--kind", "compensation", "--reason", "障害のお詫び"];

test("--users + --amount: 同じ額、--notify・--dry-run を読む", () => {
  assert.deepEqual(readBulkGrantArgs([...base, "--users", `${A},${B}`, "--amount", "3", "--notify", "--dry-run"]), {
    walletType: "regular_coin",
    kind: "compensation",
    grants: [{ userId: A, amount: 3 }, { userId: B, amount: 3 }],
    reason: "障害のお詫び",
    notify: true,
    dryRun: true,
  });
});

test("--file: 1 行 id か id,額、--amount は id だけの行の既定。空行と # を飛ばす", () => {
  const parsed = readBulkGrantArgs([...base, "--file", "g.csv", "--amount", "5"], () => `# 補填\n${A},10\n\n${B}\n`);
  assert.deepEqual(parsed.grants, [{ userId: A, amount: 10 }, { userId: B, amount: 5 }]);
  assert.deepEqual(linesOfGrantFile(` ${A} , 2 \r\n#x\n${B},`), [{ userId: A, amount: "2", line: 1 }, { userId: B, amount: undefined, line: 3 }]);
});

test("止める(TaskNotStartedError): 通貨・種類・理由なし・額なし・額の誤り・どちらも無い・両方・uuid でない・重なり・空", () => {
  const notStarted = (args: string[], why: RegExp, read?: (path: string) => string) =>
    assert.throws(() => readBulkGrantArgs(args, read), (error: Error) => error.name === "TaskNotStartedError" && why.test(error.message));
  notStarted(["--kind", "grant", "--reason", "x", "--users", A, "--amount", "1"], /--wallet-type/);
  notStarted(["--wallet-type", "regular_coin", "--kind", "gift", "--reason", "x", "--users", A, "--amount", "1"], /--kind は grant か compensation/);
  notStarted(["--wallet-type", "regular_coin", "--kind", "grant", "--users", A, "--amount", "1"], /--reason/);
  notStarted([...base, "--users", A], /--amount <n> が要ります/);
  notStarted([...base, "--users", A, "--amount", "0"], /--amount は正の整数/);
  notStarted([...base, "--users", A, "--amount", "1.5"], /--amount は正の整数/);
  notStarted([...base, "--file", "g", "--users", A, "--amount", "1"], /どちらか一方/);
  notStarted([...base, "--amount", "1"], /どちらか一方/);
  notStarted([...base, "--file", "g"], /2 行目: 額が無いか/, () => `${A},1\n${B}\n`);
  notStarted([...base, "--file", "g"], /1 行目: 額が無いか/, () => `${A},-3\n`);
  notStarted([...base, "--users", "abc", "--amount", "1"], /uuid です: abc/);
  notStarted([...base, "--users", `${A},${A}`, "--amount", "1"], /2 回並んで/);
  notStarted([...base, "--file", "g"], /付けるユーザーがいません/, () => "# none\n");
});

test("止める鍵: 中身から 1 つ(並び順は問わない、額・理由・種類・通貨が違えば別の鍵)", async () => {
  const one = { walletType: "regular_coin", kind: "grant" as const, reason: "r", grants: [{ userId: A, amount: 1 }, { userId: B, amount: 2 }] };
  const key = bulkGrantStopKey(one);
  assert.match(key, /^wallet-grant:[0-9a-f]{32}$/);
  assert.equal(bulkGrantStopKey({ ...one, grants: [...one.grants].reverse() }), key);
  assert.notEqual(bulkGrantStopKey({ ...one, grants: [{ userId: A, amount: 1 }, { userId: B, amount: 3 }] }), key);
  assert.notEqual(bulkGrantStopKey({ ...one, reason: "r2" }), key);
  assert.notEqual(bulkGrantStopKey({ ...one, kind: "compensation" }), key);
  assert.equal(task.name, "wallet:bulk-grant");
  assert.deepEqual(await task.stopKeys?.([...base, "--users", A, "--amount", "3"]), [bulkGrantStopKey({ walletType: "regular_coin", kind: "compensation", reason: "障害のお詫び", grants: [{ userId: A, amount: 3 }] })]);
});
