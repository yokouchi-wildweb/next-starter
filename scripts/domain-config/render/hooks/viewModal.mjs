// use__Domain__ViewModal.ts（詳細モーダルフック）。リレーション先の一覧フックを注入する特殊処理を含む

import { toCamelCase, toPascalCase, toPlural, toSnakeCase } from "../../../../src/utils/stringCase.mjs";

/**
 * @param {string} content トークン置換済みのテンプレート
 * @param {object | null} config domain.json
 */
export function injectViewModalRelations(content, config) {
  const relations = Array.isArray(config?.relations) ? config.relations : [];
  const details = relations.map((relation) => {
    const relationNormalized = toSnakeCase(relation.domain) || relation.domain;
    const relationCamel = toCamelCase(relationNormalized) || relationNormalized;
    const relationPascal = toPascalCase(relationNormalized) || relationNormalized;
    const hookName = `use${relationPascal}List`;
    return { hookName, importPath: `@/features/${relationCamel}/hooks/${hookName}`, camelPlural: toPlural(relationCamel) };
  });

  const relationImports = details.map(({ hookName, importPath }) => `import { ${hookName} } from "${importPath}";`).join("\n");
  const relationHooks = details.map(({ hookName, camelPlural }) => `  const { data: ${camelPlural} = [] } = ${hookName}();`).join("\n");
  const relationDependencies = details.map(({ camelPlural }) => `    ${camelPlural},`).join("\n");
  const relationSummaryBlock = details.length
    ? `    const relationSummary = Object.entries({\n${details.map(({ camelPlural }) => `      ${camelPlural},`).join("\n")}\n    })\n` +
      "      .map(([key, items]) => `${key}: ${Array.isArray(items) ? items.length : 0}件`)\n" +
      '      .join(" / ");\n\n'
    : "";

  return content
    .replace(/__RELATION_IMPORTS__/g, relationImports ? `${relationImports}\n` : "")
    .replace(/__RELATION_HOOKS__/g, relationHooks ? `${relationHooks}\n` : "")
    .replace(/__RELATION_SUMMARY_BLOCK__/g, relationSummaryBlock)
    .replace(/__RELATION_DEPENDENCIES__/g, relationDependencies);
}
