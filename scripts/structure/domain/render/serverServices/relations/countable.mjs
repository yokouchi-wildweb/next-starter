// <登録名>Base.ts の countableRelations（withCount 用: belongsToMany の件数）

import { toCamelCase, toPascalCase } from "../../../../../../src/lib/stringCase/index.mjs";
import { toPlural } from "../../../domain/plural.mjs";
import { belongsToManyRelations, junctionOf } from "../../../domain/relations.mjs";

/**
 * @returns {Array<{ literal: string, relationDomain: string | null, tableImport: string | null }>}
 *   relationDomain / tableImport はリレーション先がソフトデリートのときだけ（targetTable の import が要る）
 */
export function buildCountableRelationsSnippets(workspace, config, pascal, camel) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return belongsToManyRelations(config).map((relation) => {
    const relationPascal = toPascalCase(relation.domain);
    const relationCamel = toCamelCase(relation.domain);
    const { tableVar: throughTableVar, sourceProperty, targetProperty } = junctionOf(workspace, camel, relation);
    const targetTableImport = `${relationPascal}Table`;
    const targetConfig = workspace.readRegistration(relationCamel);
    const targetUseSoftDelete = Boolean(targetConfig && targetConfig.useSoftDelete);

    const lines = [
      "    {",
      `      field: "${toPlural(relation.domain)}",`,
      `      throughTable: ${throughTableVar},`,
      `      foreignKey: "${sourceProperty}",`,
    ];
    if (targetUseSoftDelete) {
      lines.push(`      targetTable: ${targetTableImport},`);
      lines.push(`      targetColumn: ${throughTableVar}.${targetProperty},`);
      lines.push(`      useSoftDelete: true,`);
      lines.push(`      deletedAtColumn: ${targetTableImport}.deletedAt,`);
    }
    lines.push("    }");

    return {
      literal: lines.join("\n"),
      relationDomain: targetUseSoftDelete ? relation.domain : null,
      tableImport: targetUseSoftDelete ? targetTableImport : null,
    };
  });
}
