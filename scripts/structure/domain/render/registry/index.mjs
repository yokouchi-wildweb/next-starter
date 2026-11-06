// 生成カテゴリ registry: services/server/ の domainEntry.ts・collections.ts（集まりを持つ主だけ）・storagePurposes.ts（メディア項目があるときだけ）。
// ドメインのフォルダの中だけを書く。src/registry/ の一覧は pnpm generate registry が走査で作る
// （serviceRegistry.ts だけは書き込みの後に pipeline が作り直す）。core も business も同じ。

import { renderCollectionsOutput } from "./collections.mjs";
import { renderDomainEntryOutput } from "./domainEntry.mjs";
import { renderStoragePurposesOutput } from "./storagePurpose/index.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderRegistry(ctx, workspace) {
  return [renderDomainEntryOutput(ctx), ...renderCollectionsOutput(ctx, workspace), ...renderStoragePurposesOutput(ctx, workspace)];
}
