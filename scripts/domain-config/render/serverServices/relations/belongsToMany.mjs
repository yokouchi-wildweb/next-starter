// drizzleBase.ts の belongsToManyRelations（中間テーブル経由の id 配列の同期）

import { toCamelCase, toPascalCase } from "../../../../../src/utils/stringCase.mjs";
import { belongsToManyRelations } from "../../../domain/relations.mjs";

/**
 * @returns {Array<{ tableVar: string, literal: string, lines: string[] }>}
 *   literal = オプションリテラル内（インデント付き）、lines = テンプレートの __belongsToManyRelations__ 用（インデント無し）
 */
export function buildBelongsToManySnippets(config, pascal, camel) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return belongsToManyRelations(config).map((relation) => {
    const relationPascal = toPascalCase(relation.domain);
    const relationCamel = toCamelCase(relation.domain);
    const relationTableVar = `${pascal}To${relationPascal}Table`;
    const sourceProperty = `${camel}Id`;
    const targetProperty = `${relationCamel}Id`;
    const body = [
      `fieldName: "${relation.fieldName}",`,
      `throughTable: ${relationTableVar},`,
      `sourceColumn: ${relationTableVar}.${sourceProperty},`,
      `targetColumn: ${relationTableVar}.${targetProperty},`,
      `sourceProperty: "${sourceProperty}",`,
      `targetProperty: "${targetProperty}",`,
    ];
    return {
      tableVar: relationTableVar,
      literal: ["{", ...body.map((line) => `    ${line}`), "  }"].join("\n"),
      lines: ["{", ...body, "}"],
    };
  });
}
