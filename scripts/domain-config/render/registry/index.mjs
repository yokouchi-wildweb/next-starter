// 生成カテゴリ registry: services/server/domainEntry.ts・collections.ts（集まりを持つ主だけ）と src/registry/ の各レジストリ（AUTO ブロックへの追記）。
// src/registry/serviceRegistry.ts は Output ではなく、書き込みの後に pipeline が registry:generate で丸ごと作り直す。
// core のドメインは src/registry/ の追記をしない（schemaRegistry の CORE DOMAINS などは手で。pipeline が 1 行で知らせる）。
// domainEntry.ts・collections.ts はドメインのフォルダの中なので書く（serviceRegistry.ts は今の core の手書きと同じく domainEntry.ts から載る）

import { renderCollectionsOutput } from "./collections.mjs";
import { renderDomainEntryOutput } from "./domainEntry.mjs";
import { renderAdminDataMenuPatch, renderDomainConfigRegistryPatch, renderSchemaRegistryPatch } from "./lineRegistries.mjs";
import { renderStoragePurposePatch } from "./storagePurpose/index.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderRegistry(ctx, workspace) {
  if (ctx.kind === "core") return [renderDomainEntryOutput(ctx), ...renderCollectionsOutput(ctx, workspace)];
  const outputs = [];
  if (ctx.config?.addToAdminDataMenu) {
    outputs.push(renderAdminDataMenuPatch(workspace, ctx));
  }
  outputs.push(renderDomainConfigRegistryPatch(workspace, ctx));
  outputs.push(renderSchemaRegistryPatch(workspace, ctx));
  outputs.push(renderDomainEntryOutput(ctx));
  outputs.push(...renderCollectionsOutput(ctx, workspace));
  outputs.push(...renderStoragePurposePatch(ctx, workspace));
  return outputs;
}
