// scripts/worktree/sync.ts
//
// pnpm worktree:sync [path] [--force]
//   既存ワークツリーへ本体から scripts/worktree/include の対象 (env 等) を入れ直す。
//   path 省略時は今いるワークツリー。既存ファイルは --force のときだけ上書き。

import path from "node:path";
import { parseArgs } from "node:util";

import {
  copyIncludedFiles,
  invocationDir,
  listIncludedFiles,
  mainWorktreeRoot,
  printCopyResult,
  worktreeRoot,
} from "./lib";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { force: { type: "boolean", default: false } },
});

if (positionals.length > 1) {
  console.error("使い方: pnpm worktree:sync [path] [--force]");
  process.exit(1);
}

const target = worktreeRoot(path.resolve(invocationDir(), positionals[0] ?? "."));
const mainRoot = mainWorktreeRoot(target);

if (target === mainRoot) {
  console.error("✗ 本体ワークツリーが指定されました。ワークツリーの中で実行するか、パスを指定してください");
  process.exit(1);
}

console.log("=== worktree: sync ===\n");
console.log(`${mainRoot} → ${target}`);
printCopyResult(copyIncludedFiles(mainRoot, target, listIncludedFiles(mainRoot), { force: values.force }));
