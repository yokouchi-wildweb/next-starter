#!/usr/bin/env node
// scripts/structure/registry/generate.mjs
// src/registry の α 7 本(serviceRegistry・schemaRegistry・domainConfigRegistry・storagePurposeRegistry・adminDomains・messageRegistry・recordTargetRegistry)を丸ごと生成する(pnpm generate registry)。
// 問題があれば書かずに止まる。ほかの拡張点の一覧は pnpm generate extensions。詳細: ./README.md

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildAlphaRegistries, removedAlphaOutputs, staleAlphaRegistries } from "./alpha/index.mjs";
import { generateServiceRegistry } from "./serviceRegistry/generate.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { outputs, problems } = buildAlphaRegistries(repoRoot);
if (problems.length > 0) {
  console.error(`✗ src/registry を生成できません(${problems.length} 件):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
try {
  generateServiceRegistry(repoRoot);
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const stale = staleAlphaRegistries(repoRoot, outputs);
for (const path of stale) {
  mkdirSync(dirname(join(repoRoot, path)), { recursive: true });
  writeFileSync(join(repoRoot, path), outputs[path]);
}
// もう書かない出力(印のある物だけ。phase.json の出力の宣言の glob の中): 消す
const removed = removedAlphaOutputs(repoRoot, outputs);
for (const path of removed) rmSync(join(repoRoot, path));
if (removed.length > 0) console.log(`✓ もう書かない生成物を消しました: ${removed.join(", ")}`);
console.log(stale.length > 0 ? `✓ 生成しました: ${stale.join(", ")}` : "✓ 変更なし: schemaRegistry・domainConfigRegistry・storagePurposeRegistry・adminDomains・messageRegistry・recordTargetRegistry");
