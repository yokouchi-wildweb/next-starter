#!/usr/bin/env tsx
// scripts/structure/proxies/check.ts — 門 build の門番の検査の入口(pnpm check proxies、設定の議会 L1.44)
//
// 門番の検査のうちビルドで止める物をここで順に呼ぶ。検査の本体は src/featureGate/checks に 1 検査 1 ファイル(門番 m107)。
// 今の検査: 機能を要する設定の値(featureRequirements、設定 D107・D110)。どれかが失敗したら exit 1

import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkFeatureRequirements } from "@/featureGate/node";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function main() {
  const { problems, checked } = await checkFeatureRequirements(repoRoot);
  if (problems.length > 0) {
    console.error(`❌ proxies: 機能を要する設定の値が ${problems.length} 件守られていない(featureRequirements、src/featureGate/README.md)`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(`proxies: 機能を要する設定の値 ${checked} 件 OK`);
}

void main();
