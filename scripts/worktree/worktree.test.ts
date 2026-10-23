// scripts/worktree/worktree.test.ts
//
// 一時ディレクトリに作った git リポジトリで、持ち込み対象の判定と複製の挙動を確かめる。

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  branchSlug,
  copyIncludedFiles,
  defaultWorktreePath,
  git,
  listIncludedFiles,
  mainWorktreeRoot,
  worktreeRoot,
} from "./lib";

let base: string;
let repo: string;

const write = (root: string, file: string, content: string) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
};

before(() => {
  base = realpathSync(mkdtempSync(path.join(tmpdir(), "wt-test-")));
  repo = path.join(base, "repo");
  mkdirSync(repo);
  git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.email", "test@example.com"], repo);
  git(["config", "user.name", "test"], repo);

  write(repo, ".gitignore", ".env*\n!.env.example\nnode_modules/\n.vercel\n.claude/settings.local.json\n");
  write(
    repo,
    "scripts/worktree/include",
    "# comment\n.env*\n!.env.example\n.claude/settings.local.json\n.vercel/\nnotes.txt\ntracked.txt\n",
  );
  write(repo, ".env.example", "A=\n");
  write(repo, "tracked.txt", "tracked\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);

  write(repo, ".env.development", "A=dev\n");
  write(repo, ".env.production", "A=prod\n");
  write(repo, ".claude/settings.local.json", "{}\n");
  write(repo, ".vercel/project.json", "{}\n");
  write(repo, "node_modules/pkg/index.js", "x\n");
  // パターンには一致するが gitignore 対象ではない未追跡ファイル
  write(repo, "notes.txt", "draft\n");
});

after(() => {
  rmSync(base, { recursive: true, force: true });
});

test("持ち込み対象 = 持ち込み一覧に一致し、かつ gitignore 対象のファイルだけ", () => {
  assert.deepEqual(listIncludedFiles(repo), [
    ".claude/settings.local.json",
    ".env.development",
    ".env.production",
    ".vercel/project.json",
  ]);
});

test("持ち込み一覧が無ければ対象なし", () => {
  const bare = path.join(base, "no-include");
  mkdirSync(bare);
  git(["init", "-q"], bare);
  write(bare, ".gitignore", ".env*\n");
  write(bare, ".env", "A=1\n");
  assert.deepEqual(listIncludedFiles(bare), []);
});

test("複製: 無いものは作り、違うものは force のときだけ上書きする", () => {
  const target = path.join(base, "target");
  write(target, ".env.development", "A=local\n");
  write(target, ".env.production", "A=prod\n");
  const files = listIncludedFiles(repo);

  const first = copyIncludedFiles(repo, target, files);
  assert.deepEqual(first.copied, [".claude/settings.local.json", ".vercel/project.json"]);
  assert.deepEqual(first.differs, [".env.development"]);
  assert.deepEqual(first.unchanged, [".env.production"]);
  assert.equal(readFileSync(path.join(target, ".env.development"), "utf8"), "A=local\n");

  const forced = copyIncludedFiles(repo, target, files, { force: true });
  assert.deepEqual(forced.overwritten, [".env.development"]);
  assert.equal(readFileSync(path.join(target, ".env.development"), "utf8"), "A=dev\n");
});

test("ワークツリーの中から本体のルートを引ける", () => {
  const wt = defaultWorktreePath(repo, "feature/x");
  assert.equal(wt, path.join(base, "repo.wt-feature-x"));
  git(["worktree", "add", "-q", "-b", "feature/x", wt], repo);
  mkdirSync(path.join(wt, "sub"));
  assert.equal(worktreeRoot(path.join(wt, "sub")), wt);
  assert.equal(mainWorktreeRoot(path.join(wt, "sub")), repo);
  assert.equal(mainWorktreeRoot(repo), repo);
});

test("branchSlug はフォルダ名に使えない文字を - にまとめる", () => {
  assert.equal(branchSlug("legate/2026-a.1"), "legate-2026-a.1");
  assert.equal(branchSlug("a b//c"), "a-b-c");
});
