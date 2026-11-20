// scripts/workflow/rules/ruleSize.test.mjs
// 字数の線(lib.ruleSize.mjs)の振る舞い。実行: pnpm test scripts/workflow/rules/ruleSize.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { judgeSize, longLines, SIZE_LINES } from "./lib.ruleSize.mjs";

const repoRoot = join(import.meta.dirname, "../../..");

test("CLAUDE.md: 38,000 字までは ok、越えると知らせ、40,000 字で止める", () => {
  const line = SIZE_LINES.claudeMd;
  assert.deepEqual(line, { notify: 38000, fail: 40000 });
  assert.equal(judgeSize(38000, line), "ok");
  assert.equal(judgeSize(38001, line), "notify");
  assert.equal(judgeSize(39999, line), "notify");
  assert.equal(judgeSize(40000, line), "fail");
});

test("core・service は 1 本 40,000 字、札は 10,000 字で止め、知らせる線は無い", () => {
  for (const [line, fail] of [[SIZE_LINES.core, 40000], [SIZE_LINES.service, 40000], [SIZE_LINES.card, 10000]]) {
    assert.equal(line.notify, null);
    assert.equal(line.fail, fail);
    assert.equal(judgeSize(fail - 1, line), "ok");
    assert.equal(judgeSize(fail, line), "fail");
  }
});

test("1 行 400 字: 400 字は通り 401 字は挙がる", () => {
  const text = `${"a".repeat(400)}\n${"b".repeat(401)}\nok`;
  assert.deepEqual(longLines(text), [{ line: 2, length: 401 }]);
});

test("場面のデータは無い(場面ごとの読み込みの量は数えない)", () => {
  assert.equal(existsSync(join(repoRoot, ".claude/rules/core/scenes.jsonl")), false);
});
