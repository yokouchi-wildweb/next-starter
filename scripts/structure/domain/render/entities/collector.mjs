// entities/<種類>.ts(drizzle・schema・form・model)の集める入口: 登録ごとのフォルダ entities/<登録名>/<種類>.ts を集めるだけ(D335)。
// fork と他のドメインの import の道(@/domains/<d>/entities/drizzle など)を変えないための入口で、中身を持たない。
// 書くのは置き場の道具(.notices/20261126-014453-domain-decl.place.mjs)と生成器(render/entities/index.mjs)。登録のフォルダへの移し方
// (相対の import を 1 段深く・頭の道の注記)も両方がここの moveIntoRegistration を使う

import { ENTITY_FILE_KINDS } from "../../../../../src/lib/domain/node.mjs";
import { withGeneratedMark } from "../output.mjs";

/** 集める入口を持つ種類(登録のフォルダの 4 ファイル。正は src/lib/domain の ENTITY_FILE_KINDS) */
export const ENTITY_KINDS = [...ENTITY_FILE_KINDS];

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

/** 相対の import の道を、ファイルが 1 段深く(entities/<登録名>/)へ移った時の道に */
const deeper = (specifier) => (specifier.startsWith("./") ? `../${specifier.slice(2)}` : specifier.startsWith("../") ? `../${specifier}` : specifier);

/**
 * entities/<種類>.ts の本文を entities/<登録名>/<種類>.ts へ移した本文: 一緒に移る種類(siblings)への ./ はそのまま、ほかの相対の import は
 * 1 段深く、頭の道の注記を新しい道に
 * @param {string} text 今の本文
 * @param {{ domainRel: string, registration: string, kind: string, siblings: string[] }} where siblings = 同じ登録のフォルダへ移る種類
 */
export function moveIntoRegistration(text, { domainRel, registration, kind, siblings }) {
  const rewritten = text.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(\.{1,2}\/[^"']+)\2/g, (whole, head, quote, specifier) => {
    const target = specifier.replace(/^\.\//, "").replace(/\.ts$/, "");
    return `${head}${quote}${specifier.startsWith("./") && siblings.includes(target) ? specifier : deeper(specifier)}${quote}`;
  });
  return rewritten.replace(/^\/\/ src\/domains\/[^\n]*\/entities\/[^\n]*\n/, `// ${domainRel}/entities/${registration}/${kind}.ts\n`);
}
