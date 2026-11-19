// hotfixApply.mjs の試し: 一時の上流と fork(os.tmpdir、ネットワーク不要)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

import { hotfixApply, ledgerNotes, TIP_READ } from "./hotfixApply.mjs";

const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_CONFIG_GLOBAL: "/dev/null" };
const root = mkdtempSync(join(tmpdir(), "hotfix-apply-"));
after(() => rmSync(root, { recursive: true, force: true }));
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: ENV });
const write = (repo, path, text) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};
const read = (repo, path) => readFileSync(join(repo, path), "utf8");
const commit = (repo, msg) => {
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", msg);
  return git(repo, "rev-parse", "HEAD").trim();
};

let n = 0;
/** 上流(土台 → 間の変更 → 緊急修正)と、土台で分かれた fork */
function setup({ forkEdits = false } = {}) {
  const up = join(root, `up${++n}`);
  const fork = join(root, `fork${n}`);
  mkdirSync(up);
  git(up, "init", "-q", "-b", "main");
  write(up, "src/core.ts", "a\nb\nc\n");
  write(up, "src/own.ts", "x\n");
  write(up, ".claude/skills/flux/SKILL.md", "flux 1\n");
  write(up, ".notices/shipped/next-starter.md", "- id:old\n");
  commit(up, "base");
  git(root, "clone", "-q", "-o", "upstream", up, fork);
  // 上流の間の変更(fork はまだ取り込んでいない)
  write(up, "src/core.ts", "A\nb\nc\n");
  write(up, "src/own.ts", "X\n");
  write(up, ".claude/skills/flux/SKILL.md", "flux 2\n");
  write(up, ".notices/shipped/next-starter.md", "- id:old\n- id:between\n");
  commit(up, "between");
  // 緊急修正: 同じファイルの同じ所を直す(土台の上ではぶつかる)
  write(up, "src/core.ts", "A2\nb\nc\n");
  if (forkEdits) write(up, "src/own.ts", "X2\n");
  write(up, ".claude/skills/flux/SKILL.md", "flux 3\n");
  write(up, ".notices/20261120-000000-hot.md", "# DOWNSTREAM NOTICE id:20261120-000000-hot\nhotfix: test\n");
  write(up, ".notices/shipped/next-starter.md", "- id:old\n- id:between\n- id:20261120-000000-hot | hotfix:yes\n");
  const hot = commit(up, "fix: 直す");
  if (forkEdits) {
    write(fork, "src/own.ts", "mine\n");
    commit(fork, "fork: own edit");
  }
  git(fork, "fetch", "-q", "upstream");
  return { up, fork, hot };
}

test("fork が変えていない上流のファイルの衝突は元の commit の時点の上流の版に置き換え、先端を読むファイルは外し、索引は fork 側", () => {
  const { fork, hot } = setup();
  const before = git(fork, "rev-parse", "HEAD").trim();
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.replaced, ["src/core.ts"]);
  assert.deepEqual(r.leftOut, [".claude/skills/flux/SKILL.md"]);
  assert.deepEqual(r.index, [".notices/shipped/next-starter.md"]);
  assert.equal(read(fork, "src/core.ts"), "A2\nb\nc\n");
  assert.equal(read(fork, ".claude/skills/flux/SKILL.md"), "flux 1\n");
  assert.equal(read(fork, ".notices/shipped/next-starter.md"), "- id:old\n");
  assert.equal(read(fork, ".notices/20261120-000000-hot.md").split("\n")[0], "# DOWNSTREAM NOTICE id:20261120-000000-hot");
  assert.equal(git(fork, "rev-parse", "HEAD~1").trim(), before);
  assert.match(git(fork, "log", "-1", "--format=%B"), new RegExp(`\\(cherry picked from commit ${hot}\\)`));
  assert.equal(git(fork, "status", "--porcelain").trim(), "");
  assert.equal(ledgerNotes(r), "hotfix pick; replaced: src/core.ts; left-out: .claude/skills/flux/SKILL.md");
});

test("fork が変えたファイルでぶつかったら取り消して止まる(枝も作業ツリーも元のまま)", () => {
  const { fork, hot } = setup({ forkEdits: true });
  const before = git(fork, "rev-parse", "HEAD").trim();
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "conflict");
  assert.deepEqual(r.conflicts, ["src/own.ts"]);
  assert.equal(git(fork, "rev-parse", "HEAD").trim(), before);
  assert.equal(git(fork, "status", "--porcelain").trim(), "");
  assert.equal(read(fork, "src/own.ts"), "mine\n");
});

test("作業ツリーが汚れていれば何もしない", () => {
  const { fork, hot } = setup();
  write(fork, "src/core.ts", "dirty\n");
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "error");
  assert.match(r.message, /未コミット/);
});

test("先端を読む置き場は .claude/skills/flux/", () => {
  assert.deepEqual(TIP_READ, [".claude/skills/flux/"]);
});
