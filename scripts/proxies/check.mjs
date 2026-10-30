#!/usr/bin/env node
// scripts/proxies/check.mjs
// proxy の生成一覧(src/proxies/extensions/)が項目と一致するかを検査する(pnpm proxy:check。build の冒頭で走る)。
// 書き出さない。ずれ・走査の問題があれば失敗し、直し方(pnpm proxy:generate)を出す。規則: ./extensions.mjs

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readDeclaredForkIds } from "../../src/lib/forkOwnership/forkIds.mjs";

import { discoverGateRules, discoverProxyItems, renderProxyLists, staleProxyLists } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { all: forkIds, errors } = readDeclaredForkIds(repoRoot);
const { items, problems: itemProblems } = discoverProxyItems(repoRoot, forkIds);
const { rules, problems: ruleProblems } = discoverGateRules(repoRoot, forkIds);
const problems = [...itemProblems, ...ruleProblems];
const stale = problems.length > 0 ? [] : staleProxyLists(repoRoot, renderProxyLists(items, rules));
const all = [...errors, ...problems, ...stale.map((path) => `${path}: 項目とずれている(pnpm proxy:generate で作り直してコミット)`)];
if (all.length > 0) {
  console.error(`[proxy:check] 失敗(${all.length} 件):\n${all.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`[proxy:check] OK(項目 ${items.length} / 規則 ${rules.length})`);
