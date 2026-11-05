// drizzleBase.ts / firestoreBase.ts の createCrudService オプションの組み立てと直列化。
// 関係の各スニペットは relations/ が作り、ここでオプションリテラル（Firestore 用 __serviceOptions__）と
// テンプレートの __belongsToManyRelations__（Drizzle 用。baseOptions に続く relations の行）にまとめる

import { resolveOrderByFields, resolveSearchFields } from "../../domain/fieldName.mjs";
import { buildBelongsToManySnippets } from "./relations/belongsToMany.mjs";
import { buildCountableRelationsSnippets } from "./relations/countable.mjs";
import { collectRelationDomainImports } from "./relations/imports.mjs";
import {
  buildBelongsToManyObjectRelationsSnippets,
  buildBelongsToRelationsSnippets,
  buildHasManyRelationsSnippets,
} from "./relations/withRelations.mjs";

/** domain.json の基本設定 → createCrudService のオプション（JSON で書ける部分） */
export function collectBaseServiceOptions(config) {
  if (!config) return {};
  const dbEngine = config.dbEngine || "";
  const options = {};
  if (config.idType) options.idType = config.idType;
  if (config.useCreatedAt) options.useCreatedAt = true;
  if (config.useUpdatedAt) options.useUpdatedAt = true;
  if (config.useSoftDelete) options.useSoftDelete = true;
  if (Array.isArray(config.searchFields) && config.searchFields.length) {
    options.defaultSearchFields = resolveSearchFields(config.searchFields, dbEngine);
  }
  if (Array.isArray(config.defaultOrderBy) && config.defaultOrderBy.length) {
    options.defaultOrderBy = resolveOrderByFields(config.defaultOrderBy, dbEngine);
  }
  return options;
}

/** relations の各配列を `  <key>: [\n...\n  ],` の行にする。空の配列は出さない */
function relationSections(relations, belongsToManyLiteral) {
  const sections = [];
  const push = (key, items) => {
    if (items.length) sections.push(`  ${key}: [\n${items.map((item) => item.literal).join(",\n")}\n  ],`);
  };
  if (relations.belongsToMany.length) sections.push(`  belongsToManyRelations: [\n${belongsToManyLiteral}\n  ],`);
  push("belongsToRelations", relations.belongsToRelations);
  push("belongsToManyObjectRelations", relations.belongsToManyObjectRelations);
  push("hasManyRelations", relations.hasManyRelations);
  push("countableRelations", relations.countableRelations);
  return sections;
}

/** `__serviceOptions__`: 基本オプション + relations を 1 つのオブジェクトリテラルに */
function formatOptionsLiteral(baseOptions, relations) {
  const entries = Object.entries(baseOptions).map(([key, value]) => {
    const formatted = JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
    return `  ${key}: ${formatted},`;
  });
  const belongsToManyLiteral = relations.belongsToMany.map((item) => `  ${item.literal}`).join(",\n");
  entries.push(...relationSections(relations, belongsToManyLiteral));
  if (!entries.length) return "{}";
  return `{\n${entries.join("\n")}\n}`;
}

/** `__belongsToManyRelations__`: relations だけ（Drizzle テンプレートの baseOptions に続ける行）。無ければ空 */
function formatAllRelationsLiteral(relations) {
  const belongsToManyLiteral = relations.belongsToMany
    .map((item) =>
      item.lines
        .map((line, index) => `${index === 0 || index === item.lines.length - 1 ? "    " : "      "}${line}`)
        .join("\n"),
    )
    .join(",\n");
  const sections = relationSections(relations, belongsToManyLiteral);
  if (!sections.length) return "";
  return sections.join("\n") + "\n";
}

/**
 * @returns {{ optionsLiteral: string, relationTableImports: string[], belongsToManyLiteral: string, relationDomainImports: Array<{ domain: string, tableImport: string }> }}
 */
export function composeServiceOptions(workspace, config, pascal, camel) {
  const relations = {
    belongsToMany: buildBelongsToManySnippets(config, pascal, camel),
    belongsToRelations: buildBelongsToRelationsSnippets(workspace, config, pascal, camel),
    belongsToManyObjectRelations: buildBelongsToManyObjectRelationsSnippets(workspace, config, pascal, camel),
    countableRelations: buildCountableRelationsSnippets(workspace, config, pascal, camel),
    hasManyRelations: buildHasManyRelationsSnippets(workspace, config, pascal, camel),
  };
  const relationTableImports = relations.belongsToMany.map((item) => item.tableVar).filter((v, i, a) => a.indexOf(v) === i);
  return {
    optionsLiteral: formatOptionsLiteral(collectBaseServiceOptions(config), relations),
    relationTableImports,
    belongsToManyLiteral: formatAllRelationsLiteral(relations),
    relationDomainImports: collectRelationDomainImports(relations),
  };
}
