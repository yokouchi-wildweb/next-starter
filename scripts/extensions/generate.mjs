#!/usr/bin/env node
// scripts/extensions/generate.mjs
// 全拡張点の生成一覧(<持ち主>/extensions/<点>.ts・src/wiring/<lib>.ts)を宣言と項目から丸ごと書く(pnpm extensions:generate)。
// 問題があれば書き出さずに止まる。宣言が消えた古い一覧(目印のヘッダを持つ)は消す。手で置いたファイルは消さずに失敗を出す。
// 書式と失敗の条件: ./README.md

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { planExtensions, staleOutputs, strayExtensionFiles } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const plan = planExtensions(repoRoot);
if (plan.problems.length > 0) {
  console.error(`[extensions:generate] 書き出しを止めました(${plan.problems.length} 件):\n${plan.problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

const stale = staleOutputs(repoRoot, plan.outputs);
for (const path of stale) {
  const abs = join(repoRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, plan.outputs[path]);
}
const strays = strayExtensionFiles(repoRoot, plan.outputs, plan.points);
const removed = strays.filter((s) => s.generated);
for (const stray of removed) rmSync(join(repoRoot, stray.path));
const handMade = strays.filter((s) => !s.generated);

console.log(
  `[extensions:generate] 点 ${plan.points.length} / 一覧 ${Object.keys(plan.outputs).length}` +
    (stale.length > 0 ? `、書き出し: ${stale.join(", ")}` : "、変更なし") +
    (removed.length > 0 ? `、古い一覧を削除: ${removed.map((s) => s.path).join(", ")}` : ""),
);
if (handMade.length > 0) {
  console.error(`[extensions:generate] extensions/ に手で置いたファイル(${handMade.length} 件、消していない):\n${handMade.map((s) => `  - ${s.path}: 生成物の置き場。${s.hint}`).join("\n")}`);
  process.exit(1);
}
