// scripts/workflow/worktree/sync.ts
//
// pnpm workflow worktree sync [path] [--force]
//   既存ワークツリーへ本体から scripts/workflow/worktree/include の対象 (env 等) を入れ直す。
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

const USAGE = "使い方: pnpm workflow worktree sync [path] [--force]";

let parsed: ReturnType<typeof parseArgs<{ allowPositionals: true; options: { force: { type: "boolean"; default: false } } }>>;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: { force: { type: "boolean", default: false } },
  });
} catch {
  // 知らない引数(--help 含む)は例外の跡を出さず使い方で止める
  console.error(USAGE);
  process.exit(1);
}
const { values, positionals } = parsed;

if (positionals.length > 1) {
  console.error(USAGE);
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
