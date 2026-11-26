// テンプレート（src/domains/_template、src/app/admin/_template）のドメイン名トークンの置換。
// ファイル名にも本文にも同じ関数を使う。__domainSlug__ / __domainsSlug__ / __DomainLabel__ は大文字小文字を区別しない
// __folder__ = ドメインのフォルダ(import の道 @/domains/__folder__/…)、__domain__ ほか = 登録の名前(D336: 生成の単位は登録 1 件。表 1 つのドメインは同じ値)

/**
 * @param {string} content
 * @param {import("../domain/context.mjs").DomainContext} ctx
 */
export function replaceDomainTokens(content, ctx) {
  const { camel, pascal, camelPlural, pascalPlural, kebab, kebabPlural, label, rel, folder } = ctx;
  return content
    // 頭のコメントのパス（core のドメインは src/domains/core/<folder>/。import は @/domains/<folder> の別名のまま）
    .replace(/src\/domains\/__domain__\//g, `${rel ?? `src/domains/${folder ?? camel}`}/`)
    .replace(/__folder__/g, folder ?? camel)
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__domains__/g, camelPlural)
    .replace(/__Domains__/g, pascalPlural)
    .replace(/__domainSlug__/gi, kebab ?? camel)
    .replace(/__domainsSlug__/gi, kebabPlural ?? camelPlural)
    .replace(/__domainLabel__/gi, label ?? pascal);
}
