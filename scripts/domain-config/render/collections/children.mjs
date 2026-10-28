// 主の集まりの項目名 → 従属（フォルダ名と domain.json）。主の生成物（Fields・collections.ts）が従属を読む（一方向）。
// pipeline が組の解決から ctx.collectionChildren を載せていればそれ（この実行で書き出す従属は書き出す中身）、
// 無ければ（render を直接呼ぶ経路）workspace から従属の domain.json を読む

import { toCamelCase } from "../../../../src/utils/stringCase.mjs";
import { isCollectionFieldType } from "../../spec/fieldTypes.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext & { collectionChildren?: Map<string, { camel: string, config: object | null }> }} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} [workspace]
 * @returns {Map<string, { camel: string, config: object | null }>}
 */
export function resolveCollectionChildren(ctx, workspace) {
  if (ctx.collectionChildren) return ctx.collectionChildren;
  const children = new Map();
  for (const field of ctx.config?.fields ?? []) {
    if (!isCollectionFieldType(field.fieldType) || typeof field.collection?.domain !== "string") continue;
    const camel = toCamelCase(field.collection.domain);
    children.set(field.name, { camel, config: workspace ? workspace.readConfigLenient(workspace.configPath(camel)) : null });
  }
  return children;
}
