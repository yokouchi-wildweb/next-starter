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

// 関連ドメイン定義からトークン文字列を生成
export function buildRelationTokens(relations, tokens) {
  const { camel, pascal } = tokens;

  // 関連が無い場合は空のトークンを返す
  if (!relations || relations.length === 0) {
    return {
      imports: '',
      async: '',
      listFetchNew: '',
      listFetchEdit: `  const ${camel} = (await ${camel}Service.get(id)) as ${pascal};\n`,
      swrStart: '',
      swrEnd: '',
    };
  }

  const importLines = ['import { SWRConfig } from "swr";'];
  const varNames = [];
  const listCalls = [];

  relations.forEach((rel) => {
    const normalizedDomain = toCamelCase(rel.domain) || rel.domain;
    const dom = normalizedDomain;
    importLines.push(`import { ${dom}Service } from "@/features/${dom}/services/server/${dom}Service";`);
    const plural = toPlural(dom);
    varNames.push(plural);
    listCalls.push(`${dom}Service.list()`);
  });

  const imports = importLines.join('\n');
  const asyncKeyword = 'async ';

  const listFetchNew =
    `  const [${varNames.join(', ')} ] = await Promise.all([\n    ${listCalls.join(',\n    ')}\n  ]);\n`;

  const listFetchEdit =
    `  const [${camel}, ${varNames.join(', ')} ] = await Promise.all([\n    ${camel}Service.get(id),\n    ${listCalls.join(',\n    ')}\n  ]);\n`;

  const swrStart =
    `  <SWRConfig\n    value={{\n      fallback: { ${varNames.join(', ')} },\n  }}\n  >\n`;
  const swrEnd = '  </SWRConfig>';

  return {
    imports,
    async: asyncKeyword,
    listFetchNew: replaceTokens(listFetchNew, tokens),
    listFetchEdit: replaceTokens(listFetchEdit, tokens),
    swrStart,
    swrEnd,
  };
}
