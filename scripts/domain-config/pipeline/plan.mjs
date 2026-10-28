// 1 ドメインの生成計画: 生成カテゴリ（generateFiles）に応じて render/ を呼び、書き込む前の Output を全部集める。
// ここで例外が出れば何も書かれない（検査はすべて Output を作る時点で済む）

import { hasOptionFields } from "../spec/fieldTypes.mjs";
import { renderAdminRoutes } from "../render/adminRoutes/index.mjs";
import { renderClientServices } from "../render/clientServices/index.mjs";
import { renderChildDomainConfigs } from "../render/collections/index.mjs";
import { renderComponents } from "../render/components/index.mjs";
import { renderEntities } from "../render/entities/index.mjs";
import { renderFieldConstants } from "../render/fieldConstants/index.mjs";
import { renderHooks } from "../render/hooks/index.mjs";
import { renderPresenters } from "../render/presenters/index.mjs";
import { renderRegistry } from "../render/registry/index.mjs";
import { renderServerServices } from "../render/serverServices/index.mjs";

/**
 * @param {import("../domain/context.mjs").DomainContext} ctx
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {Record<string, boolean>} gen 生成するカテゴリ（generateFiles を --only で絞ったもの）
 * @returns {import("../render/output.mjs").Output[]} 書き込み順
 */
export function planDomain(ctx, workspace, gen) {
  // 主の集まりの項目の従属の domain.json（無いときだけ書く）。生成カテゴリではないので gen に関わらず出す
  const outputs = [...renderChildDomainConfigs(ctx, workspace)];
  if (gen.components) outputs.push(...renderComponents(ctx, workspace));
  if (gen.hooks) outputs.push(...renderHooks(ctx, workspace));
  if (gen.clientServices) outputs.push(...renderClientServices(ctx, workspace));
  if (gen.serverServices) outputs.push(...renderServerServices(ctx, workspace));
  if (gen.fieldConstants && hasOptionFields(ctx.config)) outputs.push(...renderFieldConstants(ctx));
  if (gen.adminRoutes) outputs.push(...renderAdminRoutes(ctx, workspace));
  if (gen.entities) outputs.push(...renderEntities(ctx, workspace));
  if (gen.registry) outputs.push(...renderRegistry(ctx, workspace));
  if (gen.presenters) outputs.push(...renderPresenters(ctx, workspace));
  return outputs;
}
