#!/usr/bin/env node
// scripts/registry/serviceRegistry/check.mjs
// src/registry/serviceRegistry.ts が src/features/**/services/server/domainEntry.ts からの生成結果と一致するか検査する
//
// 使い方:
//   pnpm registry:check   # 手元で。build スクリプトの冒頭でも環境（VERCEL 等）に依らず必ず走る
//
// 失敗する条件: ./generate.mjs の静的検査（手書き行・重複・定義なし・record_type・import の許可・読めない行）と、
// 生成物との不一致（domainEntry.ts を足した・消した・override を置いたのに再生成していない）。直し方はどれも
// `pnpm registry:generate`（手書き行は先に domainEntry.ts / domain.json / domainEntry.override.ts へ移す）。
// サービスを実際に読み込む検査は pnpm test:service-registry（tsx）。
// 詳細: src/lib/domain/README.md

import path from "node:path";
import { fileURLToPath } from "node:url";

import { REGISTRY_FILE, readExistingRegistry } from "./discover.mjs";
import { buildServiceRegistry } from "./generate.mjs";

/** @returns {{ errors: string[], keys: string[] }} */
export function checkServiceRegistry(repoRoot) {
  const { text, errors, keys } = buildServiceRegistry(repoRoot);
  const existing = readExistingRegistry(repoRoot);
  if (!existing) {
    errors.push(`${REGISTRY_FILE} が無い → pnpm registry:generate`);
  } else if (errors.length === 0 && existing.text !== text) {
    errors.push(`${REGISTRY_FILE} が domainEntry.ts からの生成結果と一致しない → pnpm registry:generate`);
  }
  return { errors, keys };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const { errors, keys } = checkServiceRegistry(repoRoot);
  if (errors.length > 0) {
    console.error(`✗ ${REGISTRY_FILE} の検査に失敗しました:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`✓ ${REGISTRY_FILE} OK（${keys.length} キー）`);
}
