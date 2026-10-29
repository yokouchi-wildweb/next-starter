// forge の契約テスト: 段の並び・止まり方・cron の plan の推定・表の定義の hash の比較・引数。
// 実行: pnpm test:forge
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseForgeArgs } from "../run.mjs";
import { inferCronPlan, isAtMostDaily } from "../plan.mjs";
import { buildSteps, runSteps } from "../steps.mjs";
import { changedTables, snapshotTables } from "../tables.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const SILENT = { log: () => {}, error: () => {} };
const names = (steps) => steps.map((step) => step.name);
const tmpDirs = [];
after(() => tmpDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test("段の並び: 事前検査 → role → dc → routes:map → cron → 事後検査、typecheck は lint の前で最後", () => {
  const steps = buildSteps({ cronPlan: "pro" });
  const order = names(steps);
  const at = (name) => order.indexOf(name);
  assert.deepEqual([...new Set(steps.map((step) => step.phase))], ["pre", "generate", "post"]);
  assert.ok(at("role:generate --all") < at("dc:generate:all"));
  assert.ok(at("dc:generate:all") < at("routes:map"));
  assert.ok(at("routes:map") < at("cron:generate --plan pro"));
  assert.ok(at("routes:map --check") > at("routes:map"));
  assert.equal(order.at(-1), "typecheck");
  assert.ok(order.includes("cron:check"));
  assert.ok(order.includes("dc:feature-map --check"));
  assert.equal(names(buildSteps({ cronPlan: "pro", lint: true })).at(-1), "lint");
});

test("cron の plan が無い（vercel.json なし）なら cron の生成と cron:check を飛ばす", () => {
  const order = names(buildSteps({ cronPlan: null }));
  assert.ok(!order.some((name) => name.startsWith("cron:")));
});

test("止まり方: 落ちた段で止まり、後の段を回さない（事前検査で落ちれば生成の段は 1 つも回らない）", () => {
  const steps = buildSteps({ cronPlan: null });
  const failPre = runSteps(steps, { exec: (step) => step.name !== "registry:check" || step.phase !== "pre", io: SILENT });
  assert.equal(failPre.ok, false);
  assert.equal(failPre.failed.phase, "pre");
  assert.ok(!failPre.ran.includes("role:generate --all"));
  const failPost = runSteps(steps, { exec: (step) => step.name !== "test:screens", io: SILENT });
  assert.equal(failPost.failed.name, "test:screens");
  assert.ok(!failPost.ran.includes("typecheck"));
  assert.equal(runSteps(steps, { exec: () => true, io: SILENT }).ok, true);
});

test("plan の推定: 無い = 飛ばす、細かい cron がある = pro、全部 1 日 1 回 = hobby、読めない = 止める", () => {
  assert.equal(inferCronPlan(null).skip, true);
  const pro = { crons: [{ path: "/api/cron/a", schedule: "0 18 * * *" }, { path: "/api/cron/b", schedule: "*/15 * * * *" }] };
  assert.equal(inferCronPlan(JSON.stringify(pro)).plan, "pro");
  const hobby = { crons: [{ path: "/api/cron/a", schedule: "0 18 * * *" }, { path: "/api/cron/b", schedule: "5 19 * * *" }, { path: "/other", schedule: "* * * * *" }] };
  assert.equal(inferCronPlan(JSON.stringify(hobby)).plan, "hobby");
  assert.equal(inferCronPlan(JSON.stringify({})).plan, "hobby");
  assert.equal(inferCronPlan("{ broken").error, true);
});

test("1 日 1 回の判定は src/lib/cron/cronExpression.ts の isAtMostDailySchedule と同じ", () => {
  const samples = ["0 18 * * *", "5 19 * * *", "0 4 * * 1", "*/15 * * * *", "* * * * *", "10 * * * *", "0 */2 * * *", "0 1,13 * * *", "30 3 1 * *"];
  const tsx = spawnSync(
    "npx",
    ["tsx", "-e", `import { isAtMostDailySchedule } from "./src/lib/cron/cronExpression.ts"; console.log(JSON.stringify(${JSON.stringify(samples)}.map(isAtMostDailySchedule)));`],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(tsx.status, 0, tsx.stderr);
  assert.deepEqual(samples.map(isAtMostDaily), JSON.parse(tsx.stdout.trim()));
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

test("引数: --plan hobby|pro・--lint だけ受け付ける", () => {
  assert.deepEqual(parseForgeArgs([]), { plan: null, lint: false });
  assert.deepEqual(parseForgeArgs(["--", "--plan", "pro", "--lint"]), { plan: "pro", lint: true });
  assert.deepEqual(parseForgeArgs(["--plan=hobby"]), { plan: "hobby", lint: false });
  assert.throws(() => parseForgeArgs(["--plan", "free"]), /hobby か pro/);
  assert.throws(() => parseForgeArgs(["sample"]), /知らない引数/);
});
