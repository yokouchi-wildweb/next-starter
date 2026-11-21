// .notices/20261121-141602-priority-mark.priority-mark.mjs のテスト。実行: pnpm test .notices (node:test)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { markLine, plan } from "./20261121-141602-priority-mark.priority-mark.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "20261121-141602-priority-mark.priority-mark.mjs");
const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const PROJECT = "# project\n## TIER\noverrides: oripa-do.tone = casual | why: 若年層向け\n  - overrides: oripa-do.relay = never | why: r\noverrides: broken line\n- keep: me\n";
const LINEAGE = [
  "# lineage",
  "<!-- end preamble -->",
  "## oripa-do",
  "- tone (default): polite",
  "overrides: next-starter.x = 1 | why: ancestor",
  "<!-- end oripa-do -->",
  "## pandora",
  "- style (default): short",
  "overrides: oripa-do.tone = brief | why: 下流にも",
  "<!-- end pandora -->",
  "",
].join("\n");

const makeRepo = (repoId = "pandora") => {
  const root = mkdtempSync(join(tmpdir(), "priority-mark-"));
  dirs.push(root);
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  if (repoId) writeFileSync(join(root, "repo.json"), `{\n  "repo_id": "${repoId}",\n  "tier": "middle"\n}\n`);
  writeFileSync(join(root, ".claude/rules/project.md"), PROJECT);
  writeFileSync(join(root, ".claude/rules/lineage.md"), LINEAGE);
  return root;
};
const run = (root, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: "utf8" });

test("markLine: 形の合う overrides: → 印の行(字下げそのまま)、形違い = null、ほかの行 = undefined", () => {
  assert.equal(markLine("overrides: oripa-do.tone = casual | why: r"), "- tone (priority): casual (why: r)");
  assert.equal(markLine("  - overrides: a.b = 1 | why: r"), "  - b (priority): 1 (why: r)");
  assert.equal(markLine("overrides: broken"), null);
  assert.equal(markLine("overrides: a.b =  | why: r"), null);
  assert.equal(markLine("- keep: me"), undefined);
});

test("dry-run は書かず一覧を出す。--apply は project.md と自分の節だけ書き、祖先の節・形違いの行は残す。2 回目は変更 0", () => {
  const root = makeRepo();
  const dry = run(root);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /変更 4 行 \/ 止めた 1 行\(dry-run/);
  assert.equal(readFileSync(join(root, ".claude/rules/project.md"), "utf8"), PROJECT);

  assert.equal(run(root, "--apply").status, 0);
  const project = readFileSync(join(root, ".claude/rules/project.md"), "utf8");
  assert.match(project, /^- tone \(priority\): casual \(why: 若年層向け\)$/m);
  assert.match(project, /^ {2}- relay \(priority\): never \(why: r\)$/m);
  assert.match(project, /^overrides: broken line$/m);
  const lineage = readFileSync(join(root, ".claude/rules/lineage.md"), "utf8");
  assert.match(lineage, /^- tone \(default\): polite$/m, "祖先の節は触らない");
  assert.match(lineage, /^overrides: next-starter\.x = 1 \| why: ancestor$/m);
  assert.match(lineage, /^- style: short$/m);
  assert.match(lineage, /^- tone \(priority\): brief \(why: 下流にも\)$/m);

  const again = run(root, "--apply");
  assert.match(again.stdout, /変更 0 行 \/ 止めた 1 行/);
});

test("repo_id が読めない = 止める(exit 2、何も書かない)", () => {
  const root = makeRepo(null);
  const r = run(root, "--apply");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /repo_id/);
  assert.equal(readFileSync(join(root, ".claude/rules/project.md"), "utf8"), PROJECT);
  assert.equal(plan(root).files.length, 0);
});
