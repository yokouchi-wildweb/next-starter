// forge の契約テスト: 段の並び・止まり方・デプロイ先の検査・表の定義の hash の比較・引数。
// 実行: pnpm test:forge
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseForgeArgs } from "../run.mjs";
import { buildSteps, deploySteps, runSteps } from "../steps.mjs";
import { changedTables, snapshotTables } from "../tables.mjs";

const SILENT = { log: () => {}, error: () => {} };
const names = (steps) => steps.map((step) => step.name);
const tmpDirs = [];
after(() => tmpDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test("段の並び: 事前検査 → role → dc → routes:map → 事後検査（typecheck・lint）→ デプロイ先の検査。cron は生成しない", () => {
  const steps = buildSteps({ vercel: true });
  const order = names(steps);
  const at = (name) => order.indexOf(name);
  assert.deepEqual([...new Set(steps.map((step) => step.phase))], ["pre", "generate", "post", "deploy"]);
  assert.ok(at("role:generate --all") < at("dc:generate:all"));
  assert.ok(at("dc:generate:all") < at("routes:map"));
  assert.ok(at("routes:map --check") > at("routes:map"));
  assert.ok(order.includes("dc:feature-map --check"));
  assert.ok(!order.some((name) => name.startsWith("cron:generate")));
  assert.equal(order.at(-1), "cron:check");
  assert.ok(at("typecheck") < at("cron:check"));
  const withLint = names(buildSteps({ vercel: false, lint: true }));
  assert.equal(withLint.at(-1), "lint");
  assert.equal(withLint.at(-2), "typecheck");
});

test("デプロイ先の検査: vercel.json がある時だけ cron:check（plan は要らない）、落ちたら cron:generate --plan を案内", () => {
  assert.deepEqual(deploySteps({ vercel: false }), []);
  const [check] = deploySteps({ vercel: true });
  assert.equal(check.script, "cron:check");
  assert.deepEqual(check.args, []);
  const errors = [];
  runSteps([check], { exec: () => false, io: { log: () => {}, error: (m) => errors.push(m) } });
  assert.match(errors.join("\n"), /デプロイ先の検査「cron:check」.*pnpm cron:generate --plan hobby\|pro/);
});

test("止まり方: 落ちた段で止まり、後の段を回さない（事前検査で落ちれば生成の段は 1 つも回らない）", () => {
  const steps = buildSteps({ vercel: false });
  const failPre = runSteps(steps, { exec: (step) => step.name !== "registry:check" || step.phase !== "pre", io: SILENT });
  assert.equal(failPre.ok, false);
  assert.equal(failPre.failed.phase, "pre");
  assert.ok(!failPre.ran.includes("role:generate --all"));
  const failPost = runSteps(steps, { exec: (step) => step.name !== "test:screens", io: SILENT });
  assert.equal(failPost.failed.name, "test:screens");
  assert.ok(!failPost.ran.includes("typecheck"));
  assert.equal(runSteps(steps, { exec: () => true, io: SILENT }).ok, true);
});

test("表の定義の hash: 増えた・消えた・変わったファイルを出す", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-test-"));
  tmpDirs.push(root);
  const drizzle = (dir) => path.join(root, "src/features", dir, "drizzle.ts");
  for (const dir of ["a/entities", "b/entities", "core/userProfile/generated/x"]) {
    fs.mkdirSync(path.dirname(drizzle(dir)), { recursive: true });
    fs.writeFileSync(drizzle(dir), dir);
  }
  const before = snapshotTables(root);
  assert.equal(before.size, 3);
  assert.deepEqual(changedTables(before, snapshotTables(root)), []);
  fs.writeFileSync(drizzle("a/entities"), "changed");
  fs.rmSync(drizzle("b/entities"));
  fs.mkdirSync(path.dirname(drizzle("c/entities")), { recursive: true });
  fs.writeFileSync(drizzle("c/entities"), "new");
  assert.deepEqual(changedTables(before, snapshotTables(root)), ["src/features/a/entities/drizzle.ts", "src/features/b/entities/drizzle.ts", "src/features/c/entities/drizzle.ts"]);
});

test("引数: --lint だけ受け付ける", () => {
  assert.deepEqual(parseForgeArgs([]), { lint: false });
  assert.deepEqual(parseForgeArgs(["--", "--lint"]), { lint: true });
  assert.throws(() => parseForgeArgs(["--plan", "pro"]), /知らない引数/);
  assert.throws(() => parseForgeArgs(["sample"]), /知らない引数/);
});
