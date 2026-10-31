#!/usr/bin/env node
// scripts/bundle/clientChunks.mjs
// next build の結果で、管理と debug を除くページの client chunk に、全ドメインの設定と列名が届いていないかを確かめる。
// 実行: pnpm test:client-chunks(先に next build)。問題あり = exit 1、build の結果が無い = exit 2(未検証、通過ではない)。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** 公開ページの chunk に出てはいけない語(全ドメインの設定の目印と、秘匿の列名) */
export const FORBIDDEN_WORDS = ["domainConfigRegistry", "apiAccess", "generateFiles", "local_password"];

const PRIVATE_ROUTES = /^(admin|debug)(\/|$)/;

function findManifests(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findManifests(full, found);
    else if (entry.name === "page_client-reference-manifest.js") found.push(full);
  }
  return found;
}

/**
 * @param {string} distDir .next
 * @returns {{ pages: number, problems: string[] } | null} build の結果が無ければ null
 */
export function scanClientChunks(distDir) {
  const appDir = join(distDir, "server/app");
  if (!existsSync(appDir)) return null;
  const manifests = findManifests(appDir);
  if (manifests.length === 0) return null;
  const words = new Map();
  const wordsOf = (chunk) => {
    if (!words.has(chunk)) {
      const path = join(distDir, chunk);
      const body = existsSync(path) ? readFileSync(path, "utf8") : "";
      words.set(chunk, FORBIDDEN_WORDS.filter((word) => body.includes(word)));
    }
    return words.get(chunk);
  };
  let pages = 0;
  const problems = [];
  for (const manifest of manifests) {
    const route = relative(appDir, join(manifest, "..")).split(sep).join("/");
    if (PRIVATE_ROUTES.test(route)) continue;
    pages += 1;
    const chunks = new Set([...readFileSync(manifest, "utf8").matchAll(/static\/chunks\/[^"\\]+?\.js/g)].map((match) => match[0]));
    const hits = new Set([...chunks].flatMap(wordsOf));
    if (hits.size > 0) problems.push(`${route}: ${[...hits].join(", ")}`);
  }
  return { pages, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = scanClientChunks(".next");
  if (!result) {
    console.error("未検証: .next に build の結果が無い(先に next build)");
    process.exit(2);
  }
  if (result.problems.length > 0) {
    console.error(`公開ページの client chunk に届いている:\n${result.problems.join("\n")}`);
    process.exit(1);
  }
  console.log(`✓ 公開ページ ${result.pages} 本の client chunk に ${FORBIDDEN_WORDS.join("・")} は無い`);
}
