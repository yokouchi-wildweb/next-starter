import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toKebabCase,
} from '../../../../src/utils/stringCase.mjs';

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
//  - imports: SWRConfig / 関連 service / loadAdminRelationLists の import
//  - async: 追加画面を async にするか(関連の取得があるとき)
//  - relationFetchNew: 追加画面での関連一覧の取得(SWR fallback 用)
//  - editFetch: 編集画面での対象レコード + 関連一覧の取得(loadAdminEditScreen + loadAdminRelationLists)
//  - swrStart / swrEnd: SWRConfig の fallback で画面を包む
export function buildRelationTokens(relations, tokens) {
  const { camel, kebabPlural } = tokens;
  const editCall = `loadAdminEditScreen(${camel}Service, props, "/admin/${kebabPlural}")`;

  // 関連が無い場合は編集レコードの取得だけ
  if (!relations || relations.length === 0) {
    return {
      imports: '',
      async: '',
      relationFetchNew: '',
      editFetch: `  const { record: ${camel}, redirectPath } = await ${editCall};\n`,
      swrStart: '',
      swrEnd: '',
    };
  }

  const importLines = [
    'import { SWRConfig } from "swr";',
    `import { loadAdminRelationLists } from "${ADMIN_LOADERS}/adminRelations";`,
  ];
  const varNames = [];
  const serviceEntries = [];

  relations.forEach((rel) => {
    const dom = toCamelCase(rel.domain) || rel.domain;
    importLines.push(`import { ${dom}Service } from "@/features/${dom}/services/server/${dom}Service";`);
    const plural = toPlural(dom);
    varNames.push(plural);
    serviceEntries.push(`${plural}: ${dom}Service`);
  });

  const imports = importLines.join('\n');
  const asyncKeyword = 'async ';
  const relationCall = `loadAdminRelationLists({ ${serviceEntries.join(', ')} })`;

  const relationFetchNew =
    `  const { ${varNames.join(', ')} } = await ${relationCall};\n`;

  const editFetch =
    `  const [{ record: ${camel}, redirectPath }, { ${varNames.join(', ')} }] = await Promise.all([\n` +
    `    ${editCall},\n` +
    `    ${relationCall},\n` +
    `  ]);\n`;

  const swrStart =
    `  <SWRConfig\n    value={{\n      fallback: { ${varNames.join(', ')} },\n  }}\n  >\n`;
  const swrEnd = '  </SWRConfig>';

  return {
    imports,
    async: asyncKeyword,
    relationFetchNew,
    editFetch,
    swrStart,
    swrEnd,
  };
}
