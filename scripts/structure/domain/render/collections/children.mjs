// 主の集まりの項目名 → 従属（登録名とその entity.json。従属は主のドメインの中の登録、D334）。主の生成物（Fields・collections.ts）が従属を読む（一方向）。
// pipeline が組の解決から ctx.collectionChildren を載せていればそれ（この実行で書き出す従属は書き出す中身）、
// 無ければ（render を直接呼ぶ経路）workspace から従属の登録の entity.json を読む

import { toCamelCase } from "../../../../../src/lib/stringCase/index.mjs";
import { isCollectionFieldType } from "../../spec/fieldTypes.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext & { collectionChildren?: Map<string, { camel: string, config: object | null }> }} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} [workspace]
 * @returns {Map<string, { camel: string, config: object | null }>}
 */
/** 従属の登録の entity.json(主のドメインの中、D334)。読めなければ null */
function readChild(workspace, domain, child) {
  try {
    return workspace.readRegistrationConfig(domain, child);
  } catch {
    return null;
  }
}

export function resolveCollectionChildren(ctx, workspace) {
  if (ctx.collectionChildren) return ctx.collectionChildren;
  const children = new Map();
  for (const field of ctx.config?.fields ?? []) {
    if (!isCollectionFieldType(field.fieldType) || typeof field.collection?.registration !== "string") continue;
    const camel = toCamelCase(field.collection.registration);
    children.set(field.name, { camel, config: workspace ? readChild(workspace, ctx.folder ?? ctx.camel, camel) : null });
  }
  return children;
}
