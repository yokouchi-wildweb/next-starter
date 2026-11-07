#!/usr/bin/env node
// scripts/structure/extensions/check.mjs
// 全拡張点の生成一覧が宣言と項目に一致するかを検査する(pnpm check extensions。build の冒頭で走る)。書き出さない。
// 失敗: 宣言・項目の問題 / 1 行スイッチの形 / 上流の override / 枠の宣言(frame.ts)の形と置き場 / 一覧と受け口の一覧(intake.txt の生成区画)のずれ / extensions/ の宣言に無いファイル(ヘッダの無い = 手で置いた、ある = 古い一覧)。規則: ./README.md

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { planExtensions, staleOutputs, strayExtensionFiles } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const plan = planExtensions(repoRoot);
// --no-stale: 宣言・項目の問題だけを見る(一覧のずれは pnpm generate extensions で直るので見ない。forge の事前検査)
const noStale = process.argv.includes("--no-stale");
const stale = noStale || plan.problems.length > 0 ? [] : staleOutputs(repoRoot, plan.outputs);
// 受け口の一覧の生成区画(intake.txt)のずれ
if (!noStale && plan.problems.length === 0 && plan.intake && readFileSync(join(repoRoot, plan.intake.path), "utf8") !== plan.intake.content) stale.push(plan.intake.path);
const strays = strayExtensionFiles(repoRoot, plan.outputs, plan.points).filter((s) => !(noStale && s.generated));
const all = [
  ...plan.problems,
  ...stale.map((path) => `${path}: 宣言・項目とずれている(pnpm generate extensions で作り直してコミット)`),
  ...strays.map((s) =>
    s.generated
      ? `${s.path}: 宣言の無い古い一覧(pnpm generate extensions で消える)`
      : `${s.path}: extensions/ は生成物の置き場(目印のヘッダが無い = 手で置いたファイル)。${s.hint}`,
  ),
];
for (const warning of plan.warnings) console.warn(`[check extensions] warn: ${warning}`);
if (all.length > 0) {
  console.error(`[check extensions] 失敗(${all.length} 件):\n${all.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(
  `[check extensions] OK(点 ${plan.points.length} / 一覧 ${Object.keys(plan.outputs).length} / 項目 ${[...plan.itemsByPoint.values()].reduce((n, items) => n + items.length, 0)} / スイッチ ${plan.switches.length} / override ${plan.overrides.length} / 枠の表 ${plan.frames.tables} / 枠の宣言 ${plan.frames.declarations})`,
);
