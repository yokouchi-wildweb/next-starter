// テンプレート（src/features/_template、src/app/admin/_template）のドメイン名トークンの置換。
// ファイル名にも本文にも同じ関数を使う。__domainSlug__ / __domainsSlug__ / __DomainLabel__ は大文字小文字を区別しない

/**
 * @param {string} content
 * @param {import("../domain/context.mjs").DomainContext} ctx
 */
export function replaceDomainTokens(content, ctx) {
  const { camel, pascal, camelPlural, pascalPlural, kebab, kebabPlural, label } = ctx;
  return content
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__domains__/g, camelPlural)
    .replace(/__Domains__/g, pascalPlural)
    .replace(/__domainSlug__/gi, kebab ?? camel)
    .replace(/__domainsSlug__/gi, kebabPlural ?? camelPlural)
    .replace(/__domainLabel__/gi, label ?? pascal);
}
