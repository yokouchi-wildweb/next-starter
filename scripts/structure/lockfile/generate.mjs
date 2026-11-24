// scripts/structure/lockfile/generate.mjs — 段階の入口(pnpm generate lockfile): pnpm-lock.yaml を package.json から pnpm install で作り直す
// 段階の一覧(phases.json の first)が、ほかの生成器より先に回す(ほかの生成器・検査が依存の解決を読むので、D316)
import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["install"], { cwd: process.cwd(), stdio: "inherit" });
if (result.error) console.error(`lockfile: pnpm を起こせない: ${result.error.message}`);
process.exit(result.status ?? 1);
