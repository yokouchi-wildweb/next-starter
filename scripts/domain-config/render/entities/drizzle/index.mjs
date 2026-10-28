// entities/drizzle.ts（表の定義）を組み立てる。列 → 外部キー → 中間テーブル → インデックス → 秘匿カラム → 集まりの登録 の順に部品を集め、最後に文字列にする

import { domainTableName } from "../../../domain/names.mjs";
import { isCollectionFieldType } from "../../../spec/fieldTypes.mjs";
import { fieldColumns, idColumn, systemColumns } from "./columns.mjs";
import { belongsToColumns, renderDeferredForeignKeys } from "./foreignKeys.mjs";
import { collectJunctionTables, renderJunctionTables } from "./junction.mjs";
import { compositeUniqueIndexes, extraIndexes, extraIndexesHaveWhere, uniqueActiveIndexes } from "./indexes.mjs";
import { hiddenColumnsOf, renderHiddenColumnsDeclaration, validateHiddenColumns } from "./hiddenColumns.mjs";

/**
 * @param {import("../../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../../domain/workspace.mjs").Workspace} workspace
 * @returns {string} entities/drizzle.ts の内容
 */
export function renderDrizzleEntity(ctx, workspace) {
  const { config, camel, pascal, snake } = ctx;
  const tableName = domainTableName(snake, config);

  const imports = new Set(["pgTable"]);
  const relationImports = new Map();

  // 列（id → belongsTo の外部キー → fields → システム列）。順序が生成物の列順になる
  const fields = [idColumn(config, imports)];
  const { lines: fkLines, deferredForeignKeys } = belongsToColumns(ctx, workspace, tableName, imports, relationImports);
  fields.push(...fkLines);
  const { lines: fieldLines, enumDefs, uniqueFields } = fieldColumns(ctx, imports);
  fields.push(...fieldLines, ...systemColumns(config, imports));

  const junctionTables = collectJunctionTables(ctx, workspace, tableName, imports, relationImports);

  // インデックス関連の import 判定（import 行は本文より先に確定させる）
  const needsPartialIndex = config.useSoftDelete && uniqueFields.length > 0;
  const hasCompositeUniques = (config.compositeUniques || []).length > 0;
  if (needsPartialIndex || hasCompositeUniques) {
    imports.add("uniqueIndex");
  }
  validateHiddenColumns(config);
  const hiddenColumns = hiddenColumnsOf(config);
  const hasExtraIndexes = Array.isArray(config.indexes) && config.indexes.length > 0;
  if (hasExtraIndexes) {
    imports.add("index");
  }

  let content = `// src/features/${camel}/entities/drizzle.ts\n\n`;
  content += `import { ${Array.from(imports).sort().join(", ")} } from "drizzle-orm/pg-core";\n`;
  // ソフトデリート + ユニーク制約、または非ユニークインデックスの where 句があるときは sql を import
  if (needsPartialIndex || (config.useSoftDelete && hasCompositeUniques) || extraIndexesHaveWhere(config)) {
    content += `import { sql } from "drizzle-orm";\n`;
  }
  if (hiddenColumns.length > 0) {
    content += `import { defineHiddenColumns } from "@/lib/crud/drizzle/hiddenColumns";\n`;
  }
  const ownsCollections = (config.fields ?? []).some((field) => isCollectionFieldType(field.fieldType));
  if (ownsCollections) {
    content += `import { defineTableCollections } from "@/lib/crud/collections/tableCollections";\n`;
  }
  relationImports.forEach((domainPascal, domainCamel) => {
    content += `import { ${domainPascal}Table } from "@/features/${domainCamel}/entities/drizzle";\n`;
  });
  content += `\n`;
  if (enumDefs.length) content += enumDefs.join("\n") + "\n\n";

  // pgTable の第 3 引数（インデックスと短縮 FK）
  const tableIndexes = [
    ...(needsPartialIndex ? uniqueActiveIndexes(tableName, uniqueFields) : []),
    ...(hasCompositeUniques ? compositeUniqueIndexes(config, tableName) : []),
    ...(hasExtraIndexes ? extraIndexes(config, tableName) : []),
    ...renderDeferredForeignKeys(deferredForeignKeys),
  ];

  content += `export const ${pascal}Table = pgTable("${tableName}", {\n`;
  content += fields.join("\n");
  if (tableIndexes.length > 0) {
    content += `\n}, (table) => [\n`;
    content += tableIndexes.join(",\n");
    content += `\n]);\n`;
  } else {
    content += `\n});\n`;
  }

  content += renderHiddenColumnsDeclaration(pascal, hiddenColumns);
  if (ownsCollections) {
    // 他ドメインの withRelations で埋め込まれた行にも集まりを載せるため、表に宣言を登録する（collections.ts は遅延 import = 循環を避ける）
    content +=
      `\n// 主の集まりの項目（従属ドメインの行の並び）。他ドメインの withRelations で埋め込まれた行にも載せるため表に登録する\n` +
      `defineTableCollections(${pascal}Table, () => import("@/features/${camel}/services/server/collections").then((m) => m.collections));\n`;
  }
  content += renderJunctionTables(ctx, junctionTables);
  return content;
}
