#!/usr/bin/env tsx
// scripts/structure/proxies/check.ts — 門 build の門番の検査の入口(pnpm check proxies、設定の議会 L1.44)
//
// 門番の検査のうちビルドで止める物をここで順に呼ぶ。検査の本体は src/featureGate/checks に 1 検査 1 ファイル(門番 m107)。
// 今の検査: 機能を要する設定の値(featureRequirements、設定 D107・D110)・明示的に開けた子の親(explicitChildren、D121)。どれかが失敗したら exit 1

import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkExplicitChildren, checkFeatureRequirements } from "@/featureGate/node";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function main() {
  let failed = false;
  const requirements = await checkFeatureRequirements(repoRoot);
  if (requirements.problems.length > 0) {
    failed = true;
    console.error(`❌ proxies: 機能を要する設定の値が ${requirements.problems.length} 件守られていない(featureRequirements、src/featureGate/README.md)`);
    for (const problem of requirements.problems) console.error(`  - ${problem}`);
  } else console.log(`proxies: 機能を要する設定の値 ${requirements.checked} 件 OK`);
  const children = checkExplicitChildren();
  if (children.problems.length > 0) {
    failed = true;
    console.error(`❌ proxies: switches.config.ts で開けた機能 ${children.problems.length} 件の親が閉(src/featureGate/README.md)`);
    for (const problem of children.problems) console.error(`  - ${problem}`);
  } else console.log(`proxies: switches で開けた機能 ${children.checked} 件の親 OK`);
  if (failed) process.exit(1);
}

void main();
