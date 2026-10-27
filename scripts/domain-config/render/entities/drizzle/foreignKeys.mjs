// entities/drizzle.ts の belongsTo（外部キー列）。FK 名が 63 字を超えるときはテーブルコールバックの foreignKey() に回す

import { toCamelCase, toPascalCase, toSnakeCase } from "../../../../../src/utils/stringCase.mjs";
import { buildShortFkName, isFkNameTooLong } from "../../../domain/names.mjs";
import { buildOnDeleteOption, foreignTableName, getOnDeleteBehavior } from "../../../domain/relations.mjs";
import { columnFunction } from "../../../spec/fieldTypes.mjs";
import { buildColumn } from "./columns.mjs";

const ON_DELETE_LITERAL = { CASCADE: '"cascade"', SET_NULL: '"set null"', RESTRICT: '"restrict"' };

/**
 * @param {import("../../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../../domain/workspace.mjs").Workspace} workspace
 * @param {string} tableName 自分の表名
 * @param {Set<string>} imports drizzle-orm/pg-core から import する名前（追記する）
 * @param {Map<string, string>} relationImports リレーション先の表の import（camel → Pascal。追記する）
 * @returns {{ lines: string[], deferredForeignKeys: Array<{ name: string, fieldName: string, foreignTablePascal: string, onDelete: string }> }}
 */
export function belongsToColumns(ctx, workspace, tableName, imports, relationImports) {
  const { config } = ctx;
  const lines = [];
  const deferredForeignKeys = [];

  (config.relations || []).forEach((rel) => {
    if (rel.relationType !== "belongsTo") return;

    const onDeleteBehavior = getOnDeleteBehavior(rel);

    // SET_NULL + required: true は矛盾（NOT NULL 列を NULL にできない）
    if (onDeleteBehavior === "SET_NULL" && rel.required) {
      throw new Error(
        `エラー: ${rel.fieldName} で SET_NULL と required: true は同時に設定できません\n` +
          "  SET_NULL は外部キーを NULL に設定するため、required: false が必要です",
      );
    }

    const relationDomainCamel = toCamelCase(rel.domain);
    const relationDomainPascal = toPascalCase(rel.domain);
    relationImports.set(relationDomainCamel, relationDomainPascal);
    const colType = columnFunction(rel.fieldType || config.idType);
    imports.add(colType);
    const columnName = toSnakeCase(rel.fieldName);
    let column;
    if (rel.fieldType === "timestamp With Time Zone") {
      column = `timestamp("${columnName}", { withTimezone: true })`;
    } else {
      column = buildColumn(colType, columnName);
    }
    let line = `  ${rel.fieldName}: ${column}`;
    if (rel.required) line += ".notNull()";

    const foreignTable = foreignTableName(workspace, rel.domain);

    if (isFkNameTooLong(tableName, columnName, foreignTable)) {
      // FK 名が長すぎるのでテーブルコールバックで定義する
      imports.add("foreignKey");
      deferredForeignKeys.push({
        name: buildShortFkName(tableName, columnName),
        fieldName: rel.fieldName,
        foreignTablePascal: relationDomainPascal,
        onDelete: ON_DELETE_LITERAL[onDeleteBehavior] || "",
      });
    } else {
      line += `\n    .references(() => ${relationDomainPascal}Table.id${buildOnDeleteOption(onDeleteBehavior)})`;
    }
    line += ",";
    lines.push(line);
  });

  return { lines, deferredForeignKeys };
}

/** テーブルコールバックで定義する FK 制約（名前の自動短縮） */
export function renderDeferredForeignKeys(deferredForeignKeys) {
  return deferredForeignKeys.map((fk) => {
    let fkDef = `  // FK制約名の自動短縮（PostgreSQL 63文字制限対応）\n`;
    fkDef += `  foreignKey({\n`;
    fkDef += `    name: "${fk.name}",\n`;
    fkDef += `    columns: [table.${fk.fieldName}],\n`;
    fkDef += `    foreignColumns: [${fk.foreignTablePascal}Table.id],\n`;
    fkDef += `  })`;
    if (fk.onDelete) {
      fkDef += `.onDelete(${fk.onDelete})`;
    }
    return fkDef;
  });
}
