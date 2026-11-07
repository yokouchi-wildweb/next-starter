// scripts/structure/extensions/intakeOwnership.test.mjs — 生成器の出力(受け口の一覧の生成区画)と所有の検査の継ぎ目
// 実物の生成器 planExtensions で intake.txt の生成区画を書き、pnpm workflow ownership check がそれで判定することを確かめる
// (もとは src/lib/forkOwnership/check.test.mjs の 1 件。lib のテストは道具を読まない、D78)。実行: pnpm test scripts/structure/extensions/intakeOwnership.test.mjs
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runCheck } from "../../../src/lib/forkOwnership/check.mjs";
import { closeTmp, commitAll, makeFork, makeParent, openTmp, write } from "../../../src/lib/forkOwnership/testRepos.mjs";
import { planExtensions } from "./extensions.mjs";

before(() => {
  openTmp();
});
after(() => {
  closeTmp();
});

test("受け口の行は生成区画(宣言から): core の受け口の印なしの項目と core の 1 行スイッチの .replace は合格、受け口の外の core への追加は core-add", () => {
  const parent = makeParent();
  const intakePath = "src/lib/forkOwnership/intake.txt";
  write(parent, intakePath, `${readFileSync(join(parent, intakePath), "utf8")}# === AUTO-GENERATED intake START ===\n# === AUTO-GENERATED intake END ===\n`);
  write(parent, "src/features/core/user/extensionPoints.ts", 'export const extensionPoints = { cleanupHandlers: { dir: "cleanupHandlers", export: "handler", type: { from: "@/t", name: "T" }, side: "server" } };\n');
  write(parent, "src/features/core/user/cleanupHandlers/base.ts", "export const handler = 1;\n");
  write(parent, "src/features/core/payment/enricher.default.ts", "export function enrich() {}\n");
  write(parent, "src/features/core/payment/enricher.ts", 'export { enrich } from "./enricher.default";\n');
  // 生成区画は実物の生成器(pnpm generate extensions の中身)で書く
  const plan = planExtensions(parent);
  assert.deepEqual(plan.problems, []);
  write(parent, intakePath, plan.intake.content);
  assert.match(plan.intake.content, /^add src\/features\/core\/user\/cleanupHandlers\/\*\.\{ts,tsx\}/m);
  assert.match(plan.intake.content, /^add src\/features\/core\/payment\/enricher\.replace\.\{ts,tsx\}/m);
  commitAll(parent, "receptacles");

  const fork = makeFork(parent);
  write(fork, "src/features/core/user/cleanupHandlers/mine.ts", "export const handler = 2;\n");
  write(fork, "src/features/core/user/cleanupHandlers/folder/index.ts", "export const handler = 3;\n");
  write(fork, "src/features/core/payment/enricher.replace.ts", "export function enrich() {}\n");
  write(fork, "src/features/core/payment/enricher.ts", 'export { enrich } from "./enricher.replace";\n');
  commitAll(fork, "plain items");
  let result = runCheck(fork);
  const reasonOf = (path) => result.entries.find((entry) => entry.path === path)?.reason;
  assert.equal(reasonOf("src/features/core/user/cleanupHandlers/mine.ts"), "added");
  assert.equal(reasonOf("src/features/core/user/cleanupHandlers/folder/index.ts"), "added");
  assert.equal(reasonOf("src/features/core/payment/enricher.replace.ts"), "added");
  assert.equal(reasonOf("src/features/core/payment/enricher.ts"), "outside-intake", "スイッチの書き換えは手書きの edit の行(この fixture には無い)");

  write(fork, "src/features/core/payment/enricher.ts", 'export { enrich } from "./enricher.default";\n');
  write(fork, "src/features/core/user/helper.ts", "export const x = 1;\n");
  commitAll(fork, "outside");
  result = runCheck(fork);
  assert.equal(reasonOf("src/features/core/user/helper.ts"), "core-add");
  assert.equal(reasonOf("src/features/core/user/cleanupHandlers/mine.ts"), "added");
});
