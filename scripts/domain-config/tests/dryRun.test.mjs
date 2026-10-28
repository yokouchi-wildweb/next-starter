// dc:generate --dry-run（書かずに動作を一覧する）の回帰テスト。
// 実行: pnpm test:dc-dry-run
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDomainContext } from "../domain/context.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { describeOutput, reportDryRun, summarizeDryRun } from "../pipeline/dryRun.mjs";
import { planDomain } from "../pipeline/plan.mjs";
import { ALL_GENERATE_OPTIONS } from "../spec/categories.mjs";
import { file, patch, writeOnce } from "../render/output.mjs";
import { makeProject, removeAll, repoRoot } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

test("コミット済みのサンプルは「変更なし」と「保持」だけで、何も書かない", () => {
  const workspace = createWorkspace(repoRoot);
  const ctx = createDomainContext(workspace, "sample");
  const before = fs.statSync(path.join(ctx.dir, "entities", "drizzle.ts")).mtimeMs;
  const lines = [];
  const counts = reportDryRun(planDomain(ctx, workspace, ALL_GENERATE_OPTIONS), workspace, { log: (m) => lines.push(m) });
  assert.deepEqual(Object.keys(counts).sort(), ["保持", "変更なし"]);
  assert.equal(counts["保持"], 6, "page.tsx ×4 と sampleService.ts と従属 sampleImage の domain.json（集まり images）");
  assert.ok(lines.every((l) => l.startsWith("  [dry-run] ")));
  assert.equal(fs.statSync(path.join(ctx.dir, "entities", "drizzle.ts")).mtimeMs, before);
  assert.match(summarizeDryRun(counts), /^保持 6 \/ 変更なし \d+$/);
});

test("describeOutput: 作成 / 上書き / 変更なし / 移行 / スキップ を apply と同じ判定で言う", () => {
  const root = makeProject({ cleanup });
  const existing = path.join(root, "a.ts");
  fs.writeFileSync(existing, "old");
  assert.equal(describeOutput(file(path.join(root, "new.ts"), "x")).action, "作成");
  assert.equal(describeOutput(file(existing, "new")).action, "上書き");
  assert.equal(describeOutput(file(existing, "old")).action, "変更なし");
  assert.equal(describeOutput(writeOnce(existing, "x")).action, "保持");
  assert.equal(describeOutput(writeOnce(existing, "x", { migrate: { test: () => true, label: "" } })).action, "移行");
  assert.equal(describeOutput(patch(path.join(root, "none.ts"), () => ({}))).action, "スキップ");
  assert.equal(describeOutput(patch(existing, (t) => ({ text: t }))).action, "変更なし");
  assert.equal(describeOutput(patch(existing, (t) => ({ text: t + "!" }))).action, "上書き");
  assert.equal(fs.readFileSync(existing, "utf8"), "old", "dry-run は書かない");
});

test("CLI: --dry-run は --generate と併用、--yes と組み合わせて対話なしで一覧を出す", () => {
  const index = path.join(repoRoot, "scripts", "domain-config", "index.mjs");
  const bad = spawnSync("node", [index, "--init", "--dry-run"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /--dry-run は --generate と併用/);
  const ok = spawnSync("node", [index, "--generate", "sampleTag", "--yes", "--dry-run", "--only", "registry"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /\[dry-run\] sampleTag: 変更なし \d+（serviceRegistry\.ts は実行時に作り直す）/);
  assert.doesNotMatch(ok.stdout, /更新しました|生成しました/);
});
