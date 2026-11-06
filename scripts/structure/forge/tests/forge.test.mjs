// forge の契約テスト: 段の並び・止まり方・デプロイ先の検査・表の定義の hash の比較・引数。
// 実行: pnpm test scripts/structure/forge
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseForgeArgs } from "../run.mjs";
import { POST_TESTS, buildSteps, runSteps } from "../steps.mjs";
import { changedTables, snapshotTables } from "../tables.mjs";

const SILENT = { log: () => {}, error: () => {} };
const names = (steps) => steps.map((step) => step.name);
const tmpDirs = [];
after(() => tmpDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test("段の並び: 門の forge:pre → 門の生成(forge:pre・forge:post)→ 門の forge:post → テスト → typecheck(・lint)→ 門の deploy。cron は生成しない", () => {
  const steps = buildSteps();
  const order = names(steps);
  const at = (name) => order.indexOf(name);
  assert.deepEqual([...new Set(steps.map((step) => step.phase))], ["pre", "generate", "post", "deploy"]);
  assert.equal(order[0], "check --gate=forge:pre");
  assert.equal(order[1], "generate --gate=forge:pre,forge:post");
  assert.equal(order[2], "check --gate=forge:post");
  const screens = "test src/lib/screens/screens.test.mjs";
  assert.ok(at("check --gate=forge:post") < at(screens));
  assert.ok(at("test src/wiring/wiring.test.mjs") < at("typecheck"));
  assert.deepEqual(buildSteps().filter((step) => step.script === "test").map((step) => step.args), POST_TESTS);
  assert.ok(!order.some((name) => name.includes("cron")));
  assert.equal(order.at(-1), "check --gate=deploy");
  const withLint = names(buildSteps({ lint: true }));
  assert.equal(withLint.at(-2), "lint");
  assert.equal(withLint.at(-3), "typecheck");
});

test("デプロイ先の検査: 門 deploy(vercel.json が無ければ cron が飛ばして出す)、落ちたら pnpm generate cron -- --plan を案内", () => {
  const check = buildSteps().at(-1);
  assert.equal(check.script, "check");
  assert.deepEqual(check.args, ["--gate=deploy"]);
  const errors = [];
  runSteps([check], { exec: () => false, io: { log: () => {}, error: (m) => errors.push(m) } });
  assert.match(errors.join("\n"), /デプロイ先の検査「check --gate=deploy」.*pnpm generate cron -- --plan hobby\|pro/);
});

test("止まり方: 落ちた段で止まり、後の段を回さない（事前検査で落ちれば生成の段は 1 つも回らない）", () => {
  const steps = buildSteps();
  const failPre = runSteps(steps, { exec: (step) => step.name !== "check --gate=forge:pre", io: SILENT });
  assert.equal(failPre.ok, false);
  assert.equal(failPre.failed.phase, "pre");
  assert.ok(!failPre.ran.includes("generate --gate=forge:pre,forge:post"));
  const failPost = runSteps(steps, { exec: (step) => step.name !== "test src/lib/screens/screens.test.mjs", io: SILENT });
  assert.equal(failPost.failed.name, "test src/lib/screens/screens.test.mjs");
  assert.ok(!failPost.ran.includes("typecheck"));
  assert.equal(runSteps(steps, { exec: () => true, io: SILENT }).ok, true);
});

test("表の定義の hash: 増えた・消えた・変わったファイルを出す", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-test-"));
  tmpDirs.push(root);
  const table = (name) => `export const T = pgTable("${name}", {});\n`;
  const drizzle = (dir) => path.join(root, "src/features", dir, "drizzle.ts");
  for (const dir of ["a/entities", "b/entities", "core/userProfile/entities/profiles/x", "core/c/entities"]) {
    fs.mkdirSync(path.dirname(drizzle(dir)), { recursive: true });
    fs.writeFileSync(drizzle(dir), table(dir.replace(/\W/g, "_")));
  }
  // drizzle.ts でないファイルの表も見る。表の無いファイルは見ない
  const other = path.join(root, "src/features/core/c/entities/read.ts");
  fs.writeFileSync(other, table("read"));
  fs.writeFileSync(path.join(root, "src/features/core/c/entities/plain.ts"), "export const x = 1;\n");
  const before = snapshotTables(root);
  assert.equal(before.size, 5);
  assert.deepEqual(changedTables(before, snapshotTables(root)), []);
  fs.writeFileSync(drizzle("a/entities"), table("changed"));
  fs.writeFileSync(other, table("read2"));
  fs.rmSync(drizzle("b/entities"));
  fs.mkdirSync(path.dirname(drizzle("c/entities")), { recursive: true });
  fs.writeFileSync(drizzle("c/entities"), table("new"));
  assert.deepEqual(changedTables(before, snapshotTables(root)), ["src/features/a/entities/drizzle.ts", "src/features/b/entities/drizzle.ts", "src/features/c/entities/drizzle.ts", "src/features/core/c/entities/read.ts"]);
});

test("引数: --lint だけ受け付ける", () => {
  assert.deepEqual(parseForgeArgs([]), { lint: false });
  assert.deepEqual(parseForgeArgs(["--", "--lint"]), { lint: true });
  assert.throws(() => parseForgeArgs(["--plan", "pro"]), /知らない引数/);
  assert.throws(() => parseForgeArgs(["sample"]), /知らない引数/);
});
