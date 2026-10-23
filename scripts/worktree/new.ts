// scripts/worktree/new.ts
//
// pnpm worktree:new <branch> [--from <base>] [--path <dir>]
//   1. git worktree add (ブランチが無ければ --from (既定: 今の HEAD) から作る)
//   2. 本体から scripts/worktree/include の対象 (env 等) を複製
//   3. pnpm install --frozen-lockfile

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  copyIncludedFiles,
  defaultWorktreePath,
  git,
  gitSucceeds,
  invocationDir,
  listIncludedFiles,
  mainWorktreeRoot,
  printCopyResult,
} from "./lib";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    from: { type: "string" },
    path: { type: "string" },
  },
});

const branch = positionals[0];
if (!branch || positionals.length > 1) {
  console.error("使い方: pnpm worktree:new <branch> [--from <base>] [--path <dir>]");
  process.exit(1);
}

const cwd = invocationDir();
const mainRoot = mainWorktreeRoot(cwd);
const target = values.path ? path.resolve(cwd, values.path) : defaultWorktreePath(mainRoot, branch);

if (existsSync(target)) {
  console.error(`✗ ${target} は既に存在します (既存のワークツリーへ env を入れ直すなら pnpm worktree:sync)`);
  process.exit(1);
}

console.log("=== worktree: new ===\n");

const branchExists = gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd);
if (branchExists && values.from) {
  console.error(`✗ ブランチ ${branch} は既に存在するため --from は使えません`);
  process.exit(1);
}
const addArgs = branchExists
  ? ["worktree", "add", target, branch]
  : ["worktree", "add", "-b", branch, target, values.from ?? "HEAD"];
git(addArgs, cwd);
console.log(`✓ ${target} を作成 (${branchExists ? "既存ブランチ" : "新規ブランチ"} ${branch})\n`);

console.log("持ち込みファイル:");
printCopyResult(copyIncludedFiles(mainRoot, target, listIncludedFiles(mainRoot)));

console.log("\n依存インストール (pnpm install --frozen-lockfile):");
execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: target, stdio: "inherit" });

console.log(`
✓ 完了。作業を始めるには:
  cd ${target} && claude
片付け: pnpm worktree:remove ${target}
`);
