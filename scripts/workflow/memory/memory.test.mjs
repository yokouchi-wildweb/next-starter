// scripts/workflow/memory/memory.test.mjs — pnpm workflow memory(置き場の名・事実・先頭の区画)。一時のフォルダと一時の git リポだけに書く
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  applyHeader,
  checkRefs,
  collectFacts,
  commitRefs,
  formatMemo,
  HEADER_SOURCE,
  headerState,
  memoryDir,
  MemoryError,
  parseArgs,
  pathRefs,
  projectDirName,
  withHeader,
} from "./lib.mjs";

const made = [];
after(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));
const temp = (name) => {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), `memory-${name}-`)));
  made.push(d);
  return d;
};
const run = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

const SOURCE = "<!-- meditate:header (test) -->\n- memory = handoff only\n<!-- /meditate:header -->";

/** 一時のリポ: 正本と追跡ファイル 1 つ、コミット 1 つ */
const repo = () => {
  const root = temp("repo");
  run(root, "init", "-q", "-b", "main");
  run(root, "config", "user.email", "t@example.com");
  run(root, "config", "user.name", "t");
  mkdirSync(path.join(root, path.dirname(HEADER_SOURCE)), { recursive: true });
  writeFileSync(path.join(root, HEADER_SOURCE), `${SOURCE}\n`);
  mkdirSync(path.join(root, "docs"), { recursive: true });
  writeFileSync(path.join(root, "docs/rule.md"), "# rule\n- always run the formatter before you commit\n");
  run(root, "add", ".");
  run(root, "commit", "-q", "-m", "init");
  return { root, sha: run(root, "rev-parse", "--short=9", "HEAD") };
};

test("置き場: 本体の道の英数字以外を - に、CLAUDE_CONFIG_DIR の下。ワークツリーからも本体の名、--dir が先", () => {
  const { root } = repo();
  const config = temp("config");
  const env = { CLAUDE_CONFIG_DIR: config };
  const expected = path.join(config, "projects", projectDirName(root), "memory");
  assert.equal(memoryDir({ cwd: root, env }), expected);
  const wt = path.join(temp("wt"), "next-starter.wt-x");
  run(root, "worktree", "add", "-q", "-b", "wt-x", wt);
  assert.equal(memoryDir({ cwd: wt, env }), expected);
  assert.equal(projectDirName("/home/a/next-starter.wt-b_c"), "-home-a-next-starter-wt-b-c");
  assert.equal(memoryDir({ cwd: root, env, dirFlag: "/x/memory" }), "/x/memory");
});

test("参照: パスらしい語とコミットらしい語、URL と仮の名は除く", () => {
  assert.deepEqual(pathRefs("see docs/rule.md and ~/.team/_bin/ and https://a.b/c.md and <repo>/x.md and guild / fleet"), [
    "docs/rule.md",
    "~/.team/_bin/",
  ]);
  assert.deepEqual(commitRefs("commit 56f8b2221 on 20261103 deadbeef"), ["56f8b2221"]);
  const { root, sha } = repo();
  const r = checkRefs(`docs/rule.md ${sha} docs/gone.md 0abc1234`, root);
  assert.deepEqual(r, { exist: 2, total: 4, gone: ["docs/gone.md", "0abc1234"] });
});

test("事実: type・引き継ぎの 4 項目・日付の出所・同じ行・索引と索引だけの行・区画", () => {
  const { root } = repo();
  const config = temp("config");
  const dir = memoryDir({ cwd: root, env: { CLAUDE_CONFIG_DIR: config } });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "handoff.md"),
    "---\nname: h\nmetadata:\n  type: project\n  modified: 2026-11-03\n---\nstate: half done\n- next: write tests\nend: docs/rule.md exists\n",
  );
  writeFileSync(path.join(dir, "pref.md"), "---\ntype: feedback\n---\n- always run the formatter before you commit\n");
  writeFileSync(path.join(dir, "MEMORY.md"), "# Memory\n- [h](handoff.md) — x\n- [gone](gone.md) — y\n");
  const facts = collectFacts({ cwd: root, env: { CLAUDE_CONFIG_DIR: config } });
  assert.equal(facts.header, "missing");
  assert.deepEqual(facts.indexOnly, ["gone.md"]);
  const [h, p] = facts.memos;
  assert.equal(formatMemo(h), "handoff.md | type:project | handoff:state,next,end,- | date:2026-11-03(meta) | refs:1/1 | same:0 | index:yes");
  assert.equal(p.type, "feedback");
  assert.deepEqual(p.same, ["docs/rule.md:2"]);
  assert.equal(p.index, false);
  assert.match(p.date, /\(mtime\)$/);
});

test("区画: no-index → ok、missing は先頭に足す、differs は区画の中だけ、broken は書かない", () => {
  const dir = temp("mem");
  assert.equal(headerState(dir, SOURCE).state, "no-index");
  assert.equal(applyHeader(dir, SOURCE), true);
  assert.equal(readFileSync(path.join(dir, "MEMORY.md"), "utf8"), `${SOURCE}\n`);
  assert.equal(headerState(dir, SOURCE).state, "ok");
  assert.equal(applyHeader(dir, SOURCE), false);

  assert.equal(withHeader("# Memory\n- a\n", SOURCE), `${SOURCE}\n\n# Memory\n- a\n`);
  const edited = "<!-- meditate:header (test) -->\n- memory = anything\n<!-- /meditate:header -->\n\n# Memory\n- a\n";
  writeFileSync(path.join(dir, "MEMORY.md"), edited);
  assert.equal(headerState(dir, SOURCE).state, "differs");
  applyHeader(dir, SOURCE);
  assert.equal(readFileSync(path.join(dir, "MEMORY.md"), "utf8"), `${SOURCE}\n\n# Memory\n- a\n`);

  writeFileSync(path.join(dir, "MEMORY.md"), "<!-- meditate:header -->\n# Memory\n");
  assert.equal(headerState(dir, SOURCE).state, "broken");
  assert.throws(() => applyHeader(dir, SOURCE), MemoryError);
});

test("引数: --dir と(header だけ)--apply、ほかは止める", () => {
  assert.deepEqual(parseArgs(["--dir", "/m"]), { dir: "/m", apply: false });
  assert.deepEqual(parseArgs(["--apply", "--dir=/m"], { allowApply: true }), { dir: "/m", apply: true });
  assert.throws(() => parseArgs(["--apply"]), MemoryError);
});
