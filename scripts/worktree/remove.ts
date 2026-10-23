// scripts/worktree/remove.ts
//
// pnpm worktree:remove <path>
//   未コミットの変更・未追跡ファイルが無いことを確かめてから git worktree remove する。
//   ブランチは消さない (コミットは残る)。gitignore 対象 (env / node_modules) はフォルダごと消える。

import path from "node:path";

import { git, invocationDir, mainWorktreeRoot, worktreeRoot } from "./lib";

const arg = process.argv[2];
if (!arg || process.argv.length > 3) {
  console.error("使い方: pnpm worktree:remove <path>");
  process.exit(1);
}

const target = worktreeRoot(path.resolve(invocationDir(), arg));
const mainRoot = mainWorktreeRoot(target);

if (target === mainRoot) {
  console.error("✗ 本体ワークツリーは外せません");
  process.exit(1);
}

const status = git(["status", "--short"], target);
if (status.length > 0) {
  console.error(`✗ ${target} に未コミットの変更があります。コミットするか片付けてから実行してください:\n${status}`);
  process.exit(1);
}

const branch = git(["branch", "--show-current"], target);
// 消す対象の外 (本体) から実行する
git(["worktree", "remove", target], mainRoot);

console.log(`✓ ${target} を外しました`);
if (branch) {
  console.log(`ブランチ ${branch} は残っています。不要なら (マージ済みのとき): git branch -d ${branch}`);
}
