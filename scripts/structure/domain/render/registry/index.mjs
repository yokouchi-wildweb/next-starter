// 生成カテゴリ registry: services/server/ の collections.ts（集まりを持つ主だけ）・storagePurposes.ts（メディア項目があるときだけ）。
// 登録表の行は書かない(src/registry/serviceRegistry.ts は登録の entity.json から pnpm generate registry が作る、D336)。
// ドメインのフォルダの中だけを書く。src/registry/ の一覧は pnpm generate registry が走査で作る
// （serviceRegistry.ts だけは書き込みの後に pipeline が作り直す）。core も business も同じ。

import { renderCollectionsOutput } from "./collections.mjs";
import { renderStoragePurposesOutput } from "./storagePurpose/index.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderRegistry(ctx, workspace) {
  return [...renderCollectionsOutput(ctx, workspace), ...renderStoragePurposesOutput(ctx, workspace)];
}
