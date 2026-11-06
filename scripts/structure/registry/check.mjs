#!/usr/bin/env node
// scripts/structure/registry/check.mjs
// src/registry の α 5 本が走査の生成結果と一致するか検査する(pnpm check registry。build の冒頭で走る)。書かない。
// ドメインを足した・消した直後もここで止まる(直し方は pnpm generate registry)。詳細: ./README.md

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildAlphaRegistries, staleAlphaRegistries } from "./alpha/index.mjs";
import { checkServiceRegistry } from "./serviceRegistry/check.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { errors, keys } = checkServiceRegistry(repoRoot);
const { outputs, problems } = buildAlphaRegistries(repoRoot);
const stale = problems.length > 0 ? [] : staleAlphaRegistries(repoRoot, outputs);
const all = [...errors, ...problems, ...stale.map((path) => `${path} が走査の生成結果と一致しない → pnpm generate registry`)];
if (all.length > 0) {
  console.error(`✗ src/registry の検査に失敗しました(${all.length} 件):\n${all.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}
console.log(`✓ src/registry OK(serviceRegistry ${keys.length} キー・schemaRegistry・domainConfigRegistry・adminDataMenu・storagePurposeRegistry)`);
