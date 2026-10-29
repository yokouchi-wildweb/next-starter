#!/usr/bin/env node
// pnpm forge: 設定（domain.json・*.role.json・*.profile.json・cron のタスク）を書いた後の生成と検査を 1 回で回す。
// 段の並びは steps.mjs、cron の plan は plan.mjs（vercel.json から推定）、DB の案内は tables.mjs。詳細: scripts/forge/README.md
//
// 使い方:
//   pnpm forge                 # 全部（generate: true のドメインは丸ごと作り直し、false は何もしない）
//   pnpm forge --plan pro      # cron の plan の推定を上書き（hobby | pro。保存しない）
//   pnpm forge --lint          # 最後に lint（eslint . 全体、30 秒ほど）も回す
// db:push は呼ばない。表の定義が変われば最後に [user-run] の案内を出す

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { checkAllRoles } from "../role-config/generate.mjs";
import { inferCronPlan } from "./plan.mjs";
import { buildSteps, runSteps } from "./steps.mjs";
import { changedTables, snapshotTables } from "./tables.mjs";

const rootDir = path.resolve(import.meta.dirname, "../..");
const PLANS = new Set(["hobby", "pro"]);

/** 引数: --plan <hobby|pro>、--lint。ほかは止める */
export function parseForgeArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");
  const options = { plan: null, lint: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--lint") options.lint = true;
    else if (arg === "--plan" || arg.startsWith("--plan=")) {
      const value = arg === "--plan" ? args[++i] : arg.slice("--plan=".length);
      if (!PLANS.has(value)) throw new Error(`--plan は hobby か pro です（今: ${value ?? "なし"}）`);
      options.plan = value;
    } else throw new Error(`知らない引数です: ${arg}（使い方: pnpm forge [--plan hobby|pro] [--lint]）`);
  }
  return options;
}

/** 関数で回す事前検査 */
const CHECKS = {
  roles: () => {
    const issues = checkAllRoles();
    for (const issue of issues) console.error(issue);
    return issues.length === 0;
  },
};

function exec(step) {
  if (step.check) return CHECKS[step.check]();
  const result = spawnSync("pnpm", ["run", "-s", step.script, ...step.args], { cwd: rootDir, stdio: "inherit" });
  return result.status === 0;
}

function main() {
  const options = parseForgeArgs(process.argv.slice(2));
  const vercelPath = path.join(rootDir, "vercel.json");
  let cronPlan = options.plan;
  if (cronPlan === null) {
    const inferred = inferCronPlan(fs.existsSync(vercelPath) ? fs.readFileSync(vercelPath, "utf8") : null);
    if (inferred.error) throw new Error(`✗ forge: ${inferred.reason}`);
    cronPlan = inferred.plan;
    console.log(`[forge] cron: ${inferred.reason}`);
  } else {
    console.log(`[forge] cron: --plan ${cronPlan}（推定より優先。vercel.json が無ければ作る）`);
  }

  const before = snapshotTables(rootDir);
  const { ok } = runSteps(buildSteps({ cronPlan, lint: options.lint }), { exec });
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
