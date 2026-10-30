#!/usr/bin/env node
// scripts/extensions/check.mjs
// 全拡張点の生成一覧が宣言と項目に一致するかを検査する(pnpm extensions:check。build の冒頭で走る)。書き出さない。
// 失敗: 宣言・項目の問題 / 1 行スイッチの形 / 上流の override / 一覧のずれ / extensions/ の宣言に無いファイル(ヘッダの無い = 手で置いた、ある = 古い一覧)。規則: ./README.md

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { planExtensions, staleOutputs, strayExtensionFiles } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const plan = planExtensions(repoRoot);
const stale = plan.problems.length > 0 ? [] : staleOutputs(repoRoot, plan.outputs);
const strays = strayExtensionFiles(repoRoot, plan.outputs, plan.points);
const all = [
  ...plan.problems,
  ...stale.map((path) => `${path}: 宣言・項目とずれている(pnpm extensions:generate で作り直してコミット)`),
  ...strays.map((s) =>
    s.generated
      ? `${s.path}: 宣言の無い古い一覧(pnpm extensions:generate で消える)`
      : `${s.path}: extensions/ は生成物の置き場(目印のヘッダが無い = 手で置いたファイル)。${s.hint}`,
  ),
];
if (all.length > 0) {
  console.error(`[extensions:check] 失敗(${all.length} 件):\n${all.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(
  `[extensions:check] OK(点 ${plan.points.length} / 一覧 ${Object.keys(plan.outputs).length} / 項目 ${[...plan.itemsByPoint.values()].reduce((n, items) => n + items.length, 0)} / スイッチ ${plan.switches.length} / override ${plan.overrides.length})`,
);
