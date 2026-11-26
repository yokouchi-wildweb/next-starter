// scripts/structure/registry/alpha/entityCollectors.mjs
// entities/<種類>.ts(drizzle・schema・form・model)の集める入口: 登録ごとのフォルダ entities/<登録名>/<種類>.ts を集めるだけ(D335)。
// fork と他のドメインの import の道(@/domains/<d>/entities/drizzle など)を変えないための入口で、中身を持たない。
// 宣言のある全ドメイン(generate:false の登録も)に pnpm generate registry が書く: 登録のフォルダの並びのうち、その種類のファイルを持つ登録を並べる
// (どの登録もその種類を持たない = 入口を書かない。Firestore の登録は entities/<種類>.ts を生成器 pnpm generate domain が直に書く)

import { existsSync } from "node:fs";
import { join } from "node:path";

import { ENTITY_FILE_KINDS } from "../../../../src/lib/domain/node.mjs";

/** 集める入口を持つ種類(登録のフォルダの 4 ファイル。正は src/lib/domain の ENTITY_FILE_KINDS) */
export const COLLECTOR_KINDS = [...ENTITY_FILE_KINDS];

/**
 * 集める入口の本文
 * @param {string} domainRel ドメインのフォルダ(リポジトリ相対、例 src/domains/core/user)
 * @param {string} kind COLLECTOR_KINDS の 1 つ
 * @param {string[]} registrations その種類のファイルを持つ登録名(並びのまま書く)
 */
export function renderEntityCollector(domainRel, kind, registrations) {
  const path = `${domainRel}/entities/${kind}.ts`;
  return [
    `// 生成物・編集不可: pnpm generate registry が ${domainRel}/entities/*/${kind}.ts の並びから生成する`,
    `// ${path}`,
    `// 登録ごとのフォルダ(entities/<登録名>/${kind}.ts)を集めるだけの入口(import の道を変えないため)。中身は各登録のフォルダに書く`,
    "",
    ...registrations.map((registration) => `export * from "./${registration}/${kind}";`),
    "",
  ].join("\n");
}

/**
 * 宣言のある全ドメインの集める入口(パス → 本文)
 * @param {string} repoRoot
 * @param {{ dir: string, domain: object | null, registrations: { name: string, dir: string }[] }[]} declarations 宣言の読み込みの部品 readDomains の結果
 * @returns {Record<string, string>}
 */
export function renderEntityCollectors(repoRoot, declarations) {
  const outputs = {};
  for (const declaration of declarations) {
    if (declaration.domain === null) continue;
    for (const kind of COLLECTOR_KINDS) {
      const having = declaration.registrations.filter((registration) => existsSync(join(repoRoot, registration.dir, `${kind}.ts`))).map((registration) => registration.name);
      if (having.length === 0) continue;
      outputs[`${declaration.dir}/entities/${kind}.ts`] = renderEntityCollector(declaration.dir, kind, having);
    }
  }
  return outputs;
}
