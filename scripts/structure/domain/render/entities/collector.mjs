// entities/<種類>.ts(drizzle・schema・form・model)の集める入口: 登録ごとのフォルダ entities/<登録名>/<種類>.ts を集めるだけ(D335)。
// fork と他のドメインの import の道(@/domains/<d>/entities/drizzle など)を変えないための入口で、中身を持たない。
// 書くのは置き場の道具(.notices/20261126-014453-domain-decl.place.mjs)と、生成器(登録ごとに書くようになってから)

import { withGeneratedMark } from "../output.mjs";

/** 集める入口を持つ種類(登録のフォルダの 4 ファイル) */
export const ENTITY_KINDS = ["drizzle", "schema", "form", "model"];

/**
 * 集める入口の本文(生成物の印つき)
 * @param {string} domainRel ドメインのフォルダ(リポジトリ相対、例 src/domains/core/user)
 * @param {string} kind ENTITY_KINDS の 1 つ
 * @param {string[]} registrations その種類のファイルを持つ登録名(並びのまま書く)
 */
export function renderEntityCollector(domainRel, kind, registrations) {
  const path = `${domainRel}/entities/${kind}.ts`;
  const lines = [
    `// ${path}`,
    `// 登録ごとのフォルダ(entities/<登録名>/${kind}.ts)を集めるだけの入口(import の道を変えないため)。中身は各登録のフォルダに書く`,
    "",
    ...registrations.map((registration) => `export * from "./${registration}/${kind}";`),
    "",
  ];
  return withGeneratedMark(path, lines.join("\n"));
}
