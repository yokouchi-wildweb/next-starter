// scripts/structure/extensions/overrideKeys.mjs
// 宣言に無い鍵の検査(上書きの対象の点: ロール・core ロール・プロフィール・cron・domainEntry)。受け口の override の鍵は extensions.mjs が同じ形で見る。
// 上書きのファイルの export(宣言の export)の object のキーを字面で読み(実行しない)、
// - 素の形: キーは宣言の overrideOf の中だけ(core ロールの enabled・プロフィールの fields は宣言に無いので止まる)
// - keyedBy の形(domainEntry): キーは隣の対象の export(宣言の keyedBy)のキーの中だけ。値は宣言の 1 つの属性
// 値の検査(型・cron の式・access の形)は各読み手(scripts/structure/role・src/lib/cron・tsc)。pnpm check extensions(門 build)が回す

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { overrideKeys } from "./pureImports.mjs";

/**
 * @param {string} repoRoot
 * @param {{ path: string, point: { name: string, declaredIn: string, spec: object } }[]} overrides ./orphans.mjs が受けた上書き(空を除く)
 * @param {(path: string, point: object) => string} targetOf 上書き → 隣の対象
 * @returns {string[]} 問題
 */
export function checkOverrideKeys(repoRoot, overrides, targetOf) {
  const problems = [];
  for (const { path, point } of overrides) {
    const { export: exportName, keyedBy, overrideOf } = point.spec;
    const keys = overrideKeys(path, readFileSync(join(repoRoot, path), "utf8"), exportName);
    if (keys === null) {
      problems.push(`${path}: export const ${exportName} = { … } の形で書く(点 ${point.name}、${point.declaredIn})`);
      continue;
    }
    if (keyedBy) {
      const target = targetOf(path, point);
      const targetKeys = overrideKeys(target, readFileSync(join(repoRoot, target), "utf8"), keyedBy) ?? [];
      const unknown = keys.filter((k) => !targetKeys.includes(k));
      if (unknown.length > 0) problems.push(`${path}: キー ${unknown.join("・")} は隣の ${target.slice(target.lastIndexOf("/") + 1)} の ${keyedBy} に無い(値は ${overrideOf[0]} の差し替え。点 ${point.name})`);
      continue;
    }
    const denied = keys.filter((k) => !overrideOf.includes(k));
    if (denied.length > 0) problems.push(`${path}: ${denied.join("・")} は上書きできない(できるのは ${overrideOf.join("・")}。宣言 ${point.declaredIn} の ${point.name})`);
  }
  return problems;
}
