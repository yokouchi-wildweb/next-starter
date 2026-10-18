import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toKebabCase,
} from '../../../../src/utils/stringCase.mjs';
import { getStaticRelations } from '../../../../src/lib/domain/relations/relationOptions.mjs';

export { toPlural, toCamelCase, toPascalCase, toKebabCase };

// テンプレート文字列のトークンを実際の値へ置換
export function replaceTokens(
  content,
  { camel, pascal, camelPlural, pascalPlural, kebab, kebabPlural, label }
) {
  const safeLabel = label ?? pascal;
  const safeKebab = kebab ?? camel;
  const safeKebabPlural = kebabPlural ?? camelPlural;

  return content
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__domains__/g, camelPlural)
    .replace(/__Domains__/g, pascalPlural)
    .replace(/__domainSlug__/gi, safeKebab)
    .replace(/__domainsSlug__/gi, safeKebabPlural)
    .replace(/__domainLabel__/gi, safeLabel);
}

const ADMIN_LOADERS = '@/features/core/admin/services/server/loaders';

// 関連ドメイン定義から _screen/ テンプレートのトークン文字列を生成
//  - imports: SWRConfig / loadAdminRelationOptions / domain.json の import
//  - async: 追加画面を async にするか(関連の取得があるとき)
//  - relationFetchNew: 追加画面での関連選択肢の先読み(SWR fallback 用)
//  - editFetch: 編集画面での対象レコード + 関連選択肢の先読み(loadAdminEditScreen + loadAdminRelationOptions)
//  - swrStart / swrEnd: SWRConfig の fallback で画面を包む
// 先読みするのは「選択肢を全件取得する関連」(getStaticRelations: async / custom / 逆側を除く)が 1 つ以上あるときだけ。
// どの関連を読むかは loader が domain.json から同じ helper で判定し、service は serviceRegistry から解決するので、
// 生成物は関連先の service を import しない
export function buildRelationTokens(relations, tokens) {
  const { camel, kebabPlural } = tokens;
  const editCall = `loadAdminEditScreen(${camel}Service, props, "/admin/${kebabPlural}")`;

  // 先読みする関連が無い場合は編集レコードの取得だけ
  if (getStaticRelations({ relations }).length === 0) {
    return {
      imports: '',
      async: '',
      relationFetchNew: '',
      editFetch: `  const { record: ${camel}, redirectPath } = await ${editCall};\n`,
      swrStart: '',
      swrEnd: '',
    };
  }

  // 各トークンは行単位(末尾に改行を含める)。index.mjs の render がトークン行ごと置換する
  const imports = [
    'import { SWRConfig } from "swr";',
    `import { loadAdminRelationOptions } from "${ADMIN_LOADERS}/adminRelationOptions";`,
    `import domainConfig from "@/features/${camel}/domain.json";`,
  ].join('\n') + '\n';
  const asyncKeyword = 'async ';
  const relationCall = 'loadAdminRelationOptions(domainConfig)';

  const relationFetchNew = `  const relationFallback = await ${relationCall};\n`;

  const editFetch =
    `  const [{ record: ${camel}, redirectPath }, relationFallback] = await Promise.all([\n` +
    `    ${editCall},\n` +
    `    ${relationCall},\n` +
    `  ]);\n`;

  const swrStart = '  <SWRConfig value={{ fallback: relationFallback }}>\n';
  const swrEnd = '  </SWRConfig>\n';

  return {
    imports,
    async: asyncKeyword,
    relationFetchNew,
    editFetch,
    swrStart,
    swrEnd,
  };
}
