#!/usr/bin/env node
// scripts/structure/registry/serviceRegistry/check.mjs
// src/registry/serviceRegistry.ts が登録の宣言(src/domains/**/entities/*/entity.json と fork の entity.override.ts)からの生成結果と一致するか検査する
//
// 使い方:
//   pnpm check registry   # 手元で。build スクリプトの冒頭でも環境（VERCEL 等）に依らず必ず走る
//
// 失敗する条件: ./generate.mjs の静的検査(登録名・表の重なり・サービスのファイル無し・record_type・上書きの import の許可・手書きの登録表)と、
// 生成物との不一致(登録を足した・消した・entity.json の登録の鍵を変えた・上書きを置いたのに再生成していない)。直し方はどれも
// `pnpm generate registry`(手書きの行は先に登録の entity.json / entity.override.ts へ移す)。
// サービスを実際に読み込む検査は pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs（tsx）。
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
    errors.push(`${REGISTRY_FILE} が無い → pnpm generate registry`);
  } else if (errors.length === 0 && existing.text !== text) {
    errors.push(`${REGISTRY_FILE} が登録の宣言からの生成結果と一致しない → pnpm generate registry`);
  }
  return { errors, keys };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const { errors, keys } = checkServiceRegistry(repoRoot);
  if (errors.length > 0) {
    console.error(`✗ ${REGISTRY_FILE} の検査に失敗しました:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`✓ ${REGISTRY_FILE} OK（${keys.length} キー）`);
}
