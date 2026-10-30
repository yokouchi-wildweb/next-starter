#!/usr/bin/env node
// scripts/proxies/generate.mjs
// src/proxies/extensions/{handlers,decorators}.ts を src/proxies 直下の項目から丸ごと生成する(pnpm proxy:generate)。
// 走査の規則と失敗の条件: ./extensions.mjs。問題があれば書き出さずに止まる。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readDeclaredForkIds } from "../../src/lib/forkOwnership/forkIds.mjs";

import { discoverProxyItems, renderProxyLists, staleProxyLists } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { all: forkIds, errors } = readDeclaredForkIds(repoRoot);
const { items, problems } = discoverProxyItems(repoRoot, forkIds);
const all = [...errors, ...problems];
if (all.length > 0) {
  console.error(`[proxy:generate] 書き出しを止めました(${all.length} 件):\n${all.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

const expected = renderProxyLists(items);
const stale = staleProxyLists(repoRoot, expected);
for (const path of stale) {
  const abs = join(repoRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, expected[path]);
}
console.log(
  `[proxy:generate] handler ${items.filter((i) => i.kind === "handler").length} / decorator ${items.filter((i) => i.kind === "decorator").length}` +
    (stale.length > 0 ? `、書き出し: ${stale.join(", ")}` : "、変更なし"),
);
