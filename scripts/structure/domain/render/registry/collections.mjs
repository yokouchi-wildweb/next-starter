// services/server/<登録名>Collections.ts（毎回上書き）: 主の集まりの項目（mediaCollection）から createCrudService の collections の宣言を書く。
// 生成の <登録名>Base.ts はこれを import して options に渡す。<登録名>Base.ts を手書きする主（generate: false）は
// 自分で import と options を足す（渡し忘れは pnpm test scripts/structure/registry/collectionWiring/collectionWiring.test.mjs が見つける）。集まりの無い主には出さない

import path from "node:path";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../../../src/lib/stringCase/index.mjs";
import { resolveFieldName } from "../../domain/fieldName.mjs";
import { belongsToRelations } from "../../domain/relations.mjs";
import { isCollectionFieldType, isMediaFieldType } from "../../spec/fieldTypes.mjs";
import { resolveCollectionChildren } from "../collections/children.mjs";
import { file } from "../output.mjs";
import { domainRel, importRootFor } from "../../domain/context.mjs";

/** 従属の列（主への参照・値・並び）のプロパティ名。従属の登録の entity.json が無ければ雛形の名前 */
function childColumns(ownerConfig, child) {
  const ownerSnake = toSnakeCase(ownerConfig.singular);
  const config = child?.config;
  const toOwner = belongsToRelations(config).find((relation) => toSnakeCase(relation.domain ?? "") === ownerSnake);
  const media = (config?.fields ?? []).find((field) => isMediaFieldType(field.fieldType));
  return {
    parent: toOwner?.fieldName ?? `${ownerSnake}_id`,
    value: media?.name ?? "file",
    sort: config?.sortOrderField ?? "sort_order",
  };
}

/** 集まりの項目 1 つ分の宣言（CrudCollectionConfig）の行 */
function entryLines(ctx, ownerConfig, field, child) {
  const childCamel = child?.camel ?? toCamelCase(field.collection.registration);
  const table = `${toPascalCase(childCamel)}Table`;
  const columns = childColumns(ownerConfig, child);
  const collection = field.collection ?? {};
  return [
    "  {",
    `    fieldName: "${resolveFieldName(field.name, "Neon")}",`,
    `    service: () => import("${importRootFor(ctx)}/services/server/${childCamel}Service").then((m) => m.${childCamel}Service),`,
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
 * @param {import("../../domain/workspace.mjs").Workspace} [workspace] collectionChildren が無いとき従属の登録の entity.json を読む
 * @returns {import("../output.mjs").Output[]}
 */
export function renderCollectionsOutput(ctx, workspace) {
  const { config, camel } = ctx;
  const fields = (config?.fields ?? []).filter((f) => isCollectionFieldType(f.fieldType) && typeof f.collection?.registration === "string");
  if (!fields.length) return [];
  const children = resolveCollectionChildren(ctx, workspace);
  const tables = [...new Set(fields.map((f) => children.get(f.name)?.camel ?? toCamelCase(f.collection.registration)))];
  const content = [
    `// ${domainRel(ctx)}/services/server/${ctx.camel}Collections.ts`,
    "// pnpm generate domain が登録の entity.json の集まりの項目（mediaCollection）から生成する。手で直さない。",
    "// createCrudService の collections オプション（登録どうしの集まり）。生成の <登録名>Base.ts が import して渡す。",
    "// 詳細: src/lib/crud/collections/README.md",
    "",
    'import type { CrudCollectionConfig } from "@/lib/crud/server";',
    // 従属は主のドメインの中の登録(D334): 従属の表とサービスは主と同じドメインのフォルダから読む
    `import { ${tables.map((child) => `${toPascalCase(child)}Table`).join(", ")} } from "${importRootFor(ctx)}/entities/drizzle";`,
    "",
    "export const collections: CrudCollectionConfig[] = [",
    ...fields.flatMap((field) => entryLines(ctx, config, field, children.get(field.name))),
    "];",
    "",
  ].join("\n");
  return [file(path.join(ctx.dir, "services", "server", `${ctx.camel}Collections.ts`), content, { label: "集まりの宣言を生成しました" })];
}
