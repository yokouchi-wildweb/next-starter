// scripts/structure/eslint/requiredRules.test.mjs
// 必須の ESLint 規則の検査の試験。fork の設定は overrideConfig(設定ファイルの後に足される = eslint.config.fork.mjs と同じ位置)で差し替える。
// 実行: pnpm test scripts/structure/eslint/requiredRules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { ESLint } from "eslint";

import { REQUIRED_ESLINT_RULES } from "../../../eslint-rules/required-rules.mjs";
import { checkRequiredRules, severityOf } from "./requiredRules.mjs";

const repoRoot = process.cwd();
const withFork = (forkConfig) => new ESLint({ cwd: repoRoot, overrideConfig: forkConfig });

test("severityOf: 数・名前・配列", () => {
  assert.equal(severityOf("error"), 2);
  assert.equal(severityOf(["warn", {}]), 1);
  assert.equal(severityOf([0]), 0);
  assert.equal(severityOf(2), 2);
  assert.equal(severityOf(undefined), null);
});

test("upstream の設定(fork の設定は空)は通る", async () => {
  assert.deepEqual(await checkRequiredRules(withFork([]), REQUIRED_ESLINT_RULES, repoRoot), []);
});

test("fork が必須規則を off / warn にすると落ちる", async () => {
  const problems = await checkRequiredRules(
    withFork([
      { files: ["src/**/*.{ts,tsx}"], rules: { "core-ui-entry/no-inner-import": "off" } },
      { files: ["src/app/**/route.{ts,tsx}"], rules: { "route-http-export/http-export": "warn" } },
    ]),
    REQUIRED_ESLINT_RULES,
    repoRoot,
  );
  const rules = new Set(problems.map((p) => p.rule));
  assert.deepEqual([...rules].sort(), ["core-ui-entry/no-inner-import", "route-http-export/http-export"]);
  assert.ok(problems.every((p) => /強さが (off|warn)/.test(p.problem)));
});

test("一覧の外を緩める・規則を足すのは通る", async () => {
  const problems = await checkRequiredRules(
    withFork([
      {
        files: ["src/**/*.{ts,tsx}"],
        rules: {
          "style-tokens/no-raw-palette": "off",
          "react-hooks/exhaustive-deps": "warn",
          "no-restricted-syntax": ["error", { selector: "DebuggerStatement", message: "x" }],
        },
      },
    ]),
    REQUIRED_ESLINT_RULES,
    repoRoot,
  );
  assert.deepEqual(problems, []);
});

test("規則が設定に無い・代表のファイルが無いと落ちる", async () => {
  const problems = await checkRequiredRules(
    withFork([]),
    [
      { rule: "no-such-plugin/no-such-rule", files: ["src/app/(user)/layout.tsx"] },
      { rule: "core-ui-entry/no-inner-import", files: ["src/no/such/file.tsx"] },
      { rule: "realtime-room/purity", files: ["src/features/example/room/reducer.ts"], example: true },
    ],
    repoRoot,
  );
  assert.deepEqual(
    problems.map((p) => p.rule),
    ["no-such-plugin/no-such-rule", "core-ui-entry/no-inner-import"],
  );
});
