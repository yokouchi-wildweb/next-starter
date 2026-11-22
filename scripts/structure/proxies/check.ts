#!/usr/bin/env tsx
// scripts/structure/proxies/check.ts — 段階 build・ship の門番の検査の入口(pnpm check proxies、設定の議会 L1.44)
//
// 門番の検査をここで順に呼ぶ。検査の本体は src/featureGate/checks に 1 検査 1 ファイル(門番 m107)。
// 今の検査: 機能を要する設定の値(featureRequirements、設定 D107・D110)・明示的に開けた子の親(explicitChildren、D121)・
// 門番のテスト(FEATURE_GATE_CHECK=all、当議会 D133、testGate.mjs)。どれかが失敗したら exit 1
// 門番のテストは段階 build では回さない(D294: build はテストを回さない。Vercel の build には .git が無く、テストの runner が読めない)。
// 段階は run.mjs が env PHASE で渡す(名指しの pnpm check proxies は PHASE=- で、テストも回る)

import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkExplicitChildren, checkFeatureRequirements } from "@/featureGate/node";

import { runGateTests } from "./testGate.mjs";

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
  // 門番のテスト(FEATURE_GATE_CHECK=all、当議会 D133): 落ちたら違反と環境の依存の不足を分けて出し、どちらも止める。段階 build では回さない(D294)
  if (process.env.PHASE === "build") {
    console.log("proxies: 門番のテストは段階 build では回さない(出荷の段階 ship で回る)");
    if (failed) process.exit(1);
    return;
  }
  const tests = runGateTests(repoRoot);
  if (tests.ok) console.log(`proxies: 門番のテスト OK(${tests.summary.join(" / ").replaceAll("ℹ ", "")})`);
  else {
    failed = true;
    console.error(`❌ proxies: 門番のテストが落ちた(FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies、${tests.summary.join(" / ").replaceAll("ℹ ", "")})`);
    if (tests.violations.length > 0) {
      console.error(`  違反 ${tests.violations.length} 件(門番の規則・住所・コードを直す。src/featureGate/README.md):`);
      for (const v of tests.violations) console.error(`  - ${v.name}(${v.at})`);
    }
    if (tests.environment.length > 0) {
      console.error(`  環境の依存の不足 ${tests.environment.length} 件(違反ではない。門番のテストは DB・外部の env なしで通る前提 → テストの依存を外す):`);
      for (const e of tests.environment) console.error(`  - ${e.name}(${e.at}、${e.reason})`);
    }
    if (tests.violations.length + tests.environment.length === 0) console.error(`  落ちたテストを読めなかった(runner の exit ${tests.status})。出荷の直しの中で落ちた物だけ回し直す(core/notices.md checks_in_ship (2)): FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`);
  }
  if (failed) process.exit(1);
}

void main();
