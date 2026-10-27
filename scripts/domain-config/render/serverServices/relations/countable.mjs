// drizzleBase.ts の countableRelations（withCount 用: belongsToMany の件数）

import { toCamelCase, toPascalCase, toPlural } from "../../../../../src/utils/stringCase.mjs";
import { belongsToManyRelations } from "../../../domain/relations.mjs";

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
    const throughTableVar = `${pascal}To${relationPascal}Table`;
    const targetTableImport = `${relationPascal}Table`;
    const targetConfig = workspace.readConfig(relationCamel);
    const targetUseSoftDelete = Boolean(targetConfig && targetConfig.useSoftDelete);

    const lines = [
      "    {",
      `      field: "${toPlural(relation.domain)}",`,
      `      throughTable: ${throughTableVar},`,
      `      foreignKey: "${camel}Id",`,
    ];
    if (targetUseSoftDelete) {
      lines.push(`      targetTable: ${targetTableImport},`);
      lines.push(`      targetColumn: ${throughTableVar}.${relationCamel}Id,`);
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
