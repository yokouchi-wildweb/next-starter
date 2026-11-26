// 表のファイル entities/<種類>.ts を登録のフォルダ entities/<登録名>/<種類>.ts へ移す時の本文の直し方(相対の import を 1 段深く・頭の道の注記、D335)。
// 置き場の道具(.notices/20261126-014453-domain-decl.place.mjs)と生成器(render/entities/index.mjs)の両方がここの moveIntoRegistration を使う。
// 集める入口 entities/<種類>.ts は pnpm generate registry(scripts/structure/registry/alpha/entityCollectors.mjs)が書く

import { ENTITY_FILE_KINDS } from "../../../../../src/lib/domain/node.mjs";

/** 登録のフォルダの表のファイルの種類(4 ファイル。正は src/lib/domain の ENTITY_FILE_KINDS) */
export const ENTITY_KINDS = [...ENTITY_FILE_KINDS];

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
