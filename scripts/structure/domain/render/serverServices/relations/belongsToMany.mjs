// <登録名>Base.ts の belongsToManyRelations（結びの登録 through の表を経由した id 配列の同期、D354）

import { belongsToManyRelations, junctionOf } from "../../../domain/relations.mjs";

/**
 * @returns {Array<{ tableVar: string, literal: string, lines: string[] }>}
 *   literal = オプションリテラル内（インデント付き）、lines = テンプレートの __belongsToManyRelations__ 用（インデント無し）
 */
export function buildBelongsToManySnippets(workspace, config, camel) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return belongsToManyRelations(config).map((relation) => {
    const { tableVar: relationTableVar, sourceProperty, targetProperty } = junctionOf(workspace, camel, relation);
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
