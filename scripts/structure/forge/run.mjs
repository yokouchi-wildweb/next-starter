#!/usr/bin/env node
// pnpm forge: 設定（domain.json・*.role.json・*.profile.json）を書いた後の生成と検査を 1 回で回す。
// 段の並びは steps.mjs、DB の案内は tables.mjs。詳細: scripts/structure/forge/README.md
//
// 使い方:
//   pnpm forge          # 全部（generate: true のドメインは丸ごと作り直し、false は何もしない）
//   pnpm forge --lint   # 事後検査の最後に lint（eslint . 全体、30 秒ほど）も回す
// db:push も pnpm generate cron も呼ばない。表の定義が変われば最後に [user-run] の案内を出す。
// 生成と検査は門(pnpm check / generate --gate=forge:*、scripts/runner/gates)で回す。最後のデプロイ先の検査(--gate=deploy)は
// vercel.json が無ければ cron が飛ばして出す

import { spawnSync } from "node:child_process";
import path from "node:path";

import { buildSteps, runSteps } from "./steps.mjs";
import { changedTables, snapshotTables } from "./tables.mjs";

const rootDir = path.resolve(import.meta.dirname, "../../..");
/** 引数: --lint だけ。ほかは止める */
export function parseForgeArgs(argv) {
  const options = { lint: false };
  for (const arg of argv.filter((value) => value !== "--")) {
    if (arg === "--lint") options.lint = true;
    else throw new Error(`知らない引数です: ${arg}（使い方: pnpm forge [--lint]）`);
  }
  return options;
}

function exec(step) {
  const result = spawnSync("pnpm", ["run", "-s", step.script, ...step.args], { cwd: rootDir, stdio: "inherit" });
  return result.status === 0;
}

function main() {
  const options = parseForgeArgs(process.argv.slice(2));

  const before = snapshotTables(rootDir);
  const { ok } = runSteps(buildSteps({ lint: options.lint }), { exec });
  const changed = changedTables(before, snapshotTables(rootDir));
  if (changed.length > 0) {
    console.log(`\n[forge] 表の定義が変わりました（${changed.length} ファイル）:`);
    for (const file of changed) console.log(`  ${file}`);
    console.log("  [user-run] pnpm db:push を実行し、続けて pnpm db:push:check が差分 0 を返すことを確かめてください（forge は db:push を呼びません）");
  }
  if (!ok) {
    process.exitCode = 1;
    return;
  }
  console.log("\n✓ forge: 全段を通りました");
}

if (process.argv[1] === import.meta.filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
