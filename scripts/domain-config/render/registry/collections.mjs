// services/server/collections.ts（毎回上書き）: 主の集まりの項目（mediaCollection）から createCrudService の collections の宣言を書く。
// 生成の drizzleBase.ts はこれを import して options に渡す。drizzleBase.ts を手書きする主（generateFiles.serverServices: false）は
// 自分で import と options を足す（dc:generate が毎回案内する）。集まりの無い主には出さない

import path from "node:path";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { resolveFieldName } from "../../domain/fieldName.mjs";
import { belongsToRelations } from "../../domain/relations.mjs";
import { isCollectionFieldType } from "../../spec/fieldTypes.mjs";
import { file } from "../output.mjs";

/** 従属の列（主への参照・値・並び）のプロパティ名。従属の domain.json が無ければ雛形の名前 */
function childColumns(ownerConfig, child) {
  const ownerSnake = toSnakeCase(ownerConfig.singular);
  const config = child?.config;
  const toOwner = belongsToRelations(config).find((relation) => toSnakeCase(relation.domain ?? "") === ownerSnake);
  const media = (config?.fields ?? []).find((field) => field.fieldType === "mediaUploader");
  return {
    parent: toOwner?.fieldName ?? `${ownerSnake}_id`,
    value: media?.name ?? "file",
    sort: config?.sortOrderField ?? "sort_order",
  };
}

/** 集まりの項目 1 つ分の宣言（CrudCollectionConfig）の行 */
function entryLines(ownerConfig, field, child) {
  const childCamel = child?.camel ?? toCamelCase(field.collection.domain);
  const table = `${toPascalCase(childCamel)}Table`;
  const columns = childColumns(ownerConfig, child);
  const collection = field.collection ?? {};
  return [
    "  {",
    `    fieldName: "${resolveFieldName(field.name, "Neon")}",`,
    `    service: () => import("@/features/${childCamel}/services/server/${childCamel}Service").then((m) => m.${childCamel}Service),`,
    `    parentColumn: ${table}.${columns.parent},`,
    `    valueColumn: ${table}.${columns.value},`,
    `    sortColumn: ${table}.${columns.sort},`,
    ...(typeof collection.maxItems === "number" ? [`    maxItems: ${collection.maxItems},`] : []),
    ...(field.required ? ["    minItems: 1,"] : []),
    ...(typeof collection.duplicate === "boolean" ? [`    duplicate: ${collection.duplicate},`] : []),
    "  },",
  ];
}

/**
 * @param {import("../../domain/context.mjs").DomainContext & { collectionChildren?: Map<string, { camel: string, config: object | null }> }} ctx
 *   collectionChildren = 主の集まりの項目名 → 従属（pipeline が組の解決から載せる）
 * @returns {import("../output.mjs").Output[]}
 */
export function renderCollectionsOutput(ctx) {
  const { config, camel } = ctx;
  const fields = (config?.fields ?? []).filter((f) => isCollectionFieldType(f.fieldType) && typeof f.collection?.domain === "string");
  if (!fields.length) return [];
  const children = ctx.collectionChildren ?? new Map();
  const tables = [...new Set(fields.map((f) => children.get(f.name)?.camel ?? toCamelCase(f.collection.domain)))];
  const content = [
    `// src/features/${camel}/services/server/collections.ts`,
    "// dc:generate が domain.json の集まりの項目（mediaCollection）から生成する（generateFiles.registry）。手で直さない。",
    "// createCrudService の collections オプション（ドメイン集約）。生成の drizzleBase.ts が import して渡す。",
    "// 詳細: src/lib/crud/README.md「ドメイン集約（collections オプション）」",
    "",
    'import type { CrudCollectionConfig } from "@/lib/crud/drizzle";',
    ...tables.map((child) => `import { ${toPascalCase(child)}Table } from "@/features/${child}/entities/drizzle";`),
    "",
    "export const collections: CrudCollectionConfig[] = [",
    ...fields.flatMap((field) => entryLines(config, field, children.get(field.name))),
    "];",
    "",
  ].join("\n");
  return [file(path.join(ctx.dir, "services", "server", "collections.ts"), content, { label: "集まりの宣言を生成しました" })];
}
