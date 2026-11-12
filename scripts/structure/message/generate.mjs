#!/usr/bin/env node
// scripts/structure/message/generate.mjs — 門の入口(pnpm generate message [-- <domain> <name> [<旗>]])
// 引数なし = 何もしない(exit 0)。書いた時だけ src/registry(messageRegistry)と拡張点の一覧(描き方の 1 行スイッチ = 受け口の一覧の行)を作り直す。
// 中身: ./scaffold.mjs、使い方: ./README.md

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runMessageScaffold } from "./scaffold.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const result = runMessageScaffold(repoRoot, process.argv.slice(2));
for (const line of result.lines) (result.code === 0 ? console.log : console.error)(line);
if (result.code === 0 && result.written.length > 0) {
  let status = 0;
  for (const entry of ["scripts/structure/registry/generate.mjs", "scripts/structure/extensions/generate.mjs"]) {
    const run = spawnSync(process.execPath, [join(repoRoot, entry)], { stdio: "inherit", cwd: repoRoot });
    status = run.status ?? 1;
    if (status !== 0) break;
  }
  process.exitCode = status;
} else {
  process.exitCode = result.code;
}
