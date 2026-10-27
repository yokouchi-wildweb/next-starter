// drizzleBase.ts の withRelations 用の設定: belongsToRelations / belongsToManyObjectRelations / hasManyRelations。
// リレーション先のリレーションを 1 段だけ nested に展開する（belongsTo と belongsToMany は互いに再帰する）

import { toCamelCase, toPascalCase, toPlural } from "../../../../../src/utils/stringCase.mjs";
import { belongsToManyRelations, belongsToRelations, hasManyRelations } from "../../../domain/relations.mjs";

const EMPTY_NESTED = { lines: [], imports: { belongsTo: [], belongsToMany: [] } };

function indentNestedItem(item, isLast) {
  const itemLines = item.literal.split("\n").map((line, lineIdx, arr) => {
    const trimmed = line.trimStart();
    const isFirstOrLast = lineIdx === 0 || lineIdx === arr.length - 1;
    const baseIndent = "          ";
    return (isFirstOrLast ? baseIndent : baseIndent + "  ") + trimmed;
  });
  if (!isLast) itemLines[itemLines.length - 1] += ",";
  return itemLines;
}

/** nested リテラルの行 */
function buildNestedLiteralLines(nestedBelongsTo, nestedBelongsToMany) {
  const lines = ["      nested: {"];
  if (nestedBelongsTo.length > 0) {
    lines.push("        belongsTo: [");
    nestedBelongsTo.forEach((item, idx) => lines.push(...indentNestedItem(item, idx === nestedBelongsTo.length - 1)));
    lines.push("        ],");
  }
  if (nestedBelongsToMany.length > 0) {
    lines.push("        belongsToMany: [");
    nestedBelongsToMany.forEach((item, idx) => lines.push(...indentNestedItem(item, idx === nestedBelongsToMany.length - 1)));
    lines.push("        ],");
  }
  lines.push("      },");
  return lines;
}

/** リレーション先（targetConfig）のリレーションを 1 段だけ展開する。depth 0 や訪問済みなら展開しない */
function nestedFor(workspace, relation, targetConfig, visitedDomains, depth) {
  if (!(depth > 0 && !visitedDomains.has(relation.domain))) return EMPTY_NESTED;
  if (!(targetConfig && targetConfig.dbEngine === "Neon")) return EMPTY_NESTED;
  const relationPascal = toPascalCase(relation.domain);
  const relationCamel = toCamelCase(relation.domain);
  const nestedVisited = new Set(visitedDomains);
  const nestedBelongsTo = buildBelongsToRelationsSnippets(workspace, targetConfig, relationPascal, relationCamel, nestedVisited, 0);
  const nestedBelongsToMany = buildBelongsToManyObjectRelationsSnippets(workspace, targetConfig, relationPascal, relationCamel, nestedVisited, 0);
  if (nestedBelongsTo.length === 0 && nestedBelongsToMany.length === 0) return EMPTY_NESTED;
  return {
    lines: buildNestedLiteralLines(nestedBelongsTo, nestedBelongsToMany),
    imports: { belongsTo: nestedBelongsTo, belongsToMany: nestedBelongsToMany },
  };
}

function softDeleteLines(targetConfig, tableImport) {
  if (!(targetConfig && targetConfig.useSoftDelete)) return [];
  return [`      useSoftDelete: true,`, `      deletedAtColumn: ${tableImport}.deletedAt,`];
}

/** belongsTo リレーション設定（2 階層 nested 対応） */
export function buildBelongsToRelationsSnippets(workspace, config, pascal, camel, visitedDomains = new Set(), depth = 1) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];
  visitedDomains.add(config.singular);

  return belongsToRelations(config).map((relation) => {
    const relationPascal = toPascalCase(relation.domain);
    const tableImport = `${relationPascal}Table`;
    const targetConfig = workspace.readConfig(toCamelCase(relation.domain));
    const nested = nestedFor(workspace, relation, targetConfig, visitedDomains, depth);
    const lines = [
      "    {",
      `      field: "${relation.fieldName.replace(/_id$/, "")}",`,
      `      foreignKey: "${relation.fieldName}",`,
      `      table: ${tableImport},`,
      ...softDeleteLines(targetConfig, tableImport),
      ...nested.lines,
      "    }",
    ];
    return { tableImport, relationDomain: relation.domain, nestedImports: nested.imports, literal: lines.join("\n") };
  });
}

/** belongsToMany のオブジェクト展開設定（2 階層 nested 対応） */
export function buildBelongsToManyObjectRelationsSnippets(workspace, config, ownerPascal, ownerCamel, visitedDomains = new Set(), depth = 1) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];
  const currentDomain = config.singular;
  visitedDomains.add(currentDomain);

  return belongsToManyRelations(config).map((relation) => {
    const relationPascal = toPascalCase(relation.domain);
    const relationCamel = toCamelCase(relation.domain);
    const targetTableImport = `${relationPascal}Table`;
    const throughTableVar = `${ownerPascal}To${relationPascal}Table`;
    const targetConfig = workspace.readConfig(relationCamel);
    const nested = nestedFor(workspace, relation, targetConfig, visitedDomains, depth);
    const lines = [
      "    {",
      `      field: "${toPlural(relation.domain)}",`,
      `      idField: "${relation.fieldName}",`,
      `      targetTable: ${targetTableImport},`,
      `      throughTable: ${throughTableVar},`,
      `      sourceColumn: ${throughTableVar}.${ownerCamel}Id,`,
      `      targetColumn: ${throughTableVar}.${relationCamel}Id,`,
      ...softDeleteLines(targetConfig, targetTableImport),
      ...nested.lines,
      "    }",
    ];
    return {
      targetTableImport,
      throughTableVar,
      ownerDomain: toCamelCase(currentDomain),
      relationDomain: relation.domain,
      nestedImports: nested.imports,
      literal: lines.join("\n"),
    };
  });
}

/** hasMany リレーション設定（2 階層 nested 対応）。foreignKey は「親ドメインの singular + _id」= 子テーブルが親を参照する FK */
export function buildHasManyRelationsSnippets(workspace, config, pascal, camel, visitedDomains = new Set(), depth = 1) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];
  visitedDomains.add(config.singular);

  return hasManyRelations(config).map((relation) => {
    const tableImport = `${toPascalCase(relation.domain)}Table`;
    const targetConfig = workspace.readConfig(toCamelCase(relation.domain));
    const nested = nestedFor(workspace, relation, targetConfig, visitedDomains, depth);
    const lines = [
      "    {",
      `      field: "${toPlural(relation.domain)}",`,
      `      table: ${tableImport},`,
      `      foreignKey: "${config.singular}_id",`,
      ...softDeleteLines(targetConfig, tableImport),
      ...nested.lines,
      "    }",
    ];
    return { tableImport, relationDomain: relation.domain, nestedImports: nested.imports, literal: lines.join("\n") };
  });
}
