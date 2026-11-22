// scripts/operations/db/lib.push.test.ts — pnpm test scripts/operations/db/lib.push.test.ts
// pnpm db:push のデータ消失の進み方: TTY のない実行は問わずに中止し、--force で打ち直す形を出す(DB には繋がない)

import assert from "node:assert/strict";
import { test } from "node:test";

import { dataLossStep, dataLossStopMessage, forceRetryCommand } from "./lib.push";

test("dataLossStep: データ消失なし・--force は実行、端末は問う、TTY のない実行は中止", () => {
  assert.equal(dataLossStep({ hasDataLoss: false, force: false, interactive: false }), "apply");
  assert.equal(dataLossStep({ hasDataLoss: true, force: true, interactive: false }), "apply");
  assert.equal(dataLossStep({ hasDataLoss: true, force: false, interactive: true }), "ask");
  assert.equal(dataLossStep({ hasDataLoss: true, force: false, interactive: false }), "stop");
});

test("forceRetryCommand: 開発は --env なし、ほかは --env を付け、--force は 1 つ", () => {
  assert.equal(forceRetryCommand("development", []), "pnpm db:push -- --force");
  assert.equal(forceRetryCommand("production", ["--force"]), "pnpm db:push -- --env production --force");
  assert.equal(forceRetryCommand("staging", ["--verbose"]), "pnpm db:push -- --env staging --verbose --force");
});

test("dataLossStopMessage: 理由・DB は変えていない・打ち直す形", () => {
  const m = dataLossStopMessage("development", []);
  assert.match(m, /TTY のない実行なので問わずに中止しました。DB は変更していません。/);
  assert.match(m, /--force を付けて打ち直す: pnpm db:push -- --force$/);
});
