// drizzleBase.ts の withRelations 用の設定: belongsToRelations / belongsToManyObjectRelations / hasManyRelations。
// 3 種は「先頭の数行」だけが違い、リレーション先のソフトデリート・1 段の nested 展開・import 情報は共通（relationEntry）。
// belongsTo と belongsToMany は互いに再帰する（リレーション先のリレーションを 1 段だけ nested に展開）

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

/**
 * 1 リレーション分の設定オブジェクト。head（種別ごとの先頭行）の後に、リレーション先のソフトデリートと nested を続ける
 * @param {string[]} head  種別ごとの行（`      field: ...,` など）
 * @param {string} tableImport リレーション先の表（deletedAtColumn に使う）
 * @param {object} extra  import の収集（relations/imports.mjs）が読む追加情報
 */
function relationEntry(workspace, relation, visitedDomains, depth, { head, tableImport, extra }) {
  const targetConfig = workspace.readConfig(toCamelCase(relation.domain));
  const nested = nestedFor(workspace, relation, targetConfig, visitedDomains, depth);
  const softDelete = targetConfig?.useSoftDelete ? [`      useSoftDelete: true,`, `      deletedAtColumn: ${tableImport}.deletedAt,`] : [];
  const lines = ["    {", ...head, ...softDelete, ...nested.lines, "    }"];
  return { relationDomain: relation.domain, nestedImports: nested.imports, literal: lines.join("\n"), ...extra };
}

/** 共通の前提: relations があり Neon。visited に自分を足す */
function prepare(config, visitedDomains) {
  if (!Array.isArray(config.relations) || config.dbEngine !== "Neon") return false;
  visitedDomains.add(config.singular);
  return true;
}

/** belongsTo リレーション設定（2 階層 nested 対応） */
export function buildBelongsToRelationsSnippets(workspace, config, pascal, camel, visitedDomains = new Set(), depth = 1) {
  if (!prepare(config, visitedDomains)) return [];
  return belongsToRelations(config).map((relation) => {
    const tableImport = `${toPascalCase(relation.domain)}Table`;
    return relationEntry(workspace, relation, visitedDomains, depth, {
      head: [`      field: "${relation.fieldName.replace(/_id$/, "")}",`, `      foreignKey: "${relation.fieldName}",`, `      table: ${tableImport},`],
      tableImport,
      extra: { tableImport },
    });
  });
}

/** belongsToMany のオブジェクト展開設定（2 階層 nested 対応） */
export function buildBelongsToManyObjectRelationsSnippets(workspace, config, ownerPascal, ownerCamel, visitedDomains = new Set(), depth = 1) {
  if (!prepare(config, visitedDomains)) return [];
  return belongsToManyRelations(config).map((relation) => {
    const relationPascal = toPascalCase(relation.domain);
    const relationCamel = toCamelCase(relation.domain);
    const targetTableImport = `${relationPascal}Table`;
    const throughTableVar = `${ownerPascal}To${relationPascal}Table`;
    return relationEntry(workspace, relation, visitedDomains, depth, {
      head: [
        `      field: "${toPlural(relation.domain)}",`,
        `      idField: "${relation.fieldName}",`,
        `      targetTable: ${targetTableImport},`,
        `      throughTable: ${throughTableVar},`,
        `      sourceColumn: ${throughTableVar}.${ownerCamel}Id,`,
        `      targetColumn: ${throughTableVar}.${relationCamel}Id,`,
      ],
      tableImport: targetTableImport,
      extra: { targetTableImport, throughTableVar, ownerDomain: toCamelCase(config.singular) },
    });
  });
}

/** hasMany リレーション設定（2 階層 nested 対応）。foreignKey は「親ドメインの singular + _id」= 子テーブルが親を参照する FK */
export function buildHasManyRelationsSnippets(workspace, config, pascal, camel, visitedDomains = new Set(), depth = 1) {
  if (!prepare(config, visitedDomains)) return [];
  return hasManyRelations(config).map((relation) => {
    const tableImport = `${toPascalCase(relation.domain)}Table`;
    return relationEntry(workspace, relation, visitedDomains, depth, {
      head: [`      field: "${toPlural(relation.domain)}",`, `      table: ${tableImport},`, `      foreignKey: "${config.singular}_id",`],
      tableImport,
      extra: { tableImport },
    });
  });
}
