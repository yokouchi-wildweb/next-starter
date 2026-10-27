// entities/drizzle.ts の belongsToMany の中間テーブル（<Domain>To<Relation>Table）。両側 CASCADE、複合主キー

import { toCamelCase, toPascalCase, toSnakeCase } from "../../../../../src/utils/stringCase.mjs";
import { buildShortFkName, isFkNameTooLong } from "../../../domain/names.mjs";
import { foreignTableName } from "../../../domain/relations.mjs";
import { buildColumn, mapType } from "./columns.mjs";

/**
 * 中間テーブルの情報を集める。FK 名の 63 字超過はここ（import 行の確定前）で判定し、必要なら imports に foreignKey を足す
 * @returns {Array<object>} renderJunctionTables に渡す
 */
export function collectJunctionTables(ctx, workspace, tableName, imports, relationImports) {
  const { config, camel, pascal } = ctx;
  const tables = [];

  (config.relations || []).forEach((rel) => {
    if (rel.relationType !== "belongsToMany" || rel.includeRelationTable === false) return;
    const typeFn = mapType(rel.fieldType || config.idType);
    imports.add(typeFn);
    const relationDomainCamel = toCamelCase(rel.domain);
    const relationDomainPascal = toPascalCase(rel.domain);
    relationImports.set(relationDomainCamel, relationDomainPascal);
    const relationRoot = `${pascal}To${relationDomainPascal}`;
    const junctionTableName = toSnakeCase(relationRoot);
    const baseColumnName = `${toSnakeCase(camel)}_id`;
    const relationColumnName = `${toSnakeCase(relationDomainCamel)}_id`;
    const baseFkTooLong = isFkNameTooLong(junctionTableName, baseColumnName, tableName);
    const relationFkTooLong = isFkNameTooLong(
      junctionTableName,
      relationColumnName,
      foreignTableName(workspace, relationDomainCamel),
    );
    if (baseFkTooLong || relationFkTooLong) imports.add("foreignKey");
    tables.push({
      tableVar: `${relationRoot}Table`,
      tableName: junctionTableName,
      typeFn,
      domainCamel: relationDomainCamel,
      domainPascal: relationDomainPascal,
      baseColumnName,
      relationColumnName,
      baseFkTooLong,
      relationFkTooLong,
    });
  });

  if (tables.length > 0) imports.add("primaryKey");
  return tables;
}

/** 中間テーブルの pgTable 定義を本文に足す */
export function renderJunctionTables(ctx, tables) {
  const { camel, pascal } = ctx;
  let content = "";
  tables.forEach((t) => {
    const { baseColumnName, relationColumnName, baseFkTooLong, relationFkTooLong } = t;
    const baseColumn = buildColumn(t.typeFn, baseColumnName);
    const relationColumn = buildColumn(t.typeFn, relationColumnName);

    let baseColDef = `    ${camel}Id: ${baseColumn}\n      .notNull()`;
    let relationColDef = `    ${t.domainCamel}Id: ${relationColumn}\n      .notNull()`;
    if (!baseFkTooLong) {
      baseColDef += `\n      .references(() => ${pascal}Table.id, { onDelete: "cascade" })`;
    }
    if (!relationFkTooLong) {
      relationColDef += `\n      .references(() => ${t.domainPascal}Table.id, { onDelete: "cascade" })`;
    }

    const callbackItems = [`pk: primaryKey({ columns: [table.${camel}Id, table.${t.domainCamel}Id] })`];
    if (baseFkTooLong) {
      const shortName = buildShortFkName(t.tableName, baseColumnName);
      callbackItems.push(
        `${camel}Fk: foreignKey({\n      name: "${shortName}",\n      columns: [table.${camel}Id],\n      foreignColumns: [${pascal}Table.id],\n    }).onDelete("cascade")`,
      );
    }
    if (relationFkTooLong) {
      const shortName = buildShortFkName(t.tableName, relationColumnName);
      callbackItems.push(
        `${t.domainCamel}Fk: foreignKey({\n      name: "${shortName}",\n      columns: [table.${t.domainCamel}Id],\n      foreignColumns: [${t.domainPascal}Table.id],\n    }).onDelete("cascade")`,
      );
    }

    const callbackBody = callbackItems.map((item) => `    ${item}`).join(",\n");
    content += `\nexport const ${t.tableVar} = pgTable(\n  "${t.tableName}",\n  {\n${baseColDef},\n${relationColDef},\n  },\n  (table) => {\n    return {\n${callbackBody},\n    };\n  },\n);\n`;
  });
  return content;
}
