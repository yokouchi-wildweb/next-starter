// 1 ドメインの生成: 読む（context）→ 検査（checks）→ 作る（plan）→ 書く（apply）→ serviceRegistry を作り直す。
// 対話（生成方法の選択・上書き確認）は cli/generate.mjs。ここは --yes でも対話でも同じ

import { assertPreflight } from "../checks/index.mjs";
import { createDomainContext } from "../domain/context.mjs";
import { narrowGenerateTargets } from "../spec/categories.mjs";
import { applyOutputs } from "./apply.mjs";
import { planDomain } from "./plan.mjs";
import { regenerateServiceRegistry } from "./serviceRegistry.mjs";

/**
 * domain.json を読み、生成前の検査を通す。フォルダ名のずれ・Firestore のメディア列は何も書く前に止める
 * @returns {import("../domain/context.mjs").DomainContext}
 */
export function loadDomainForGenerate(workspace, domainInput) {
  const input = (domainInput || "").trim();
  if (!input) {
    throw new Error("ドメイン名を指定してください。");
  }
  const ctx = createDomainContext(workspace, input);
  if (!ctx.config) {
    throw new Error(`設定ファイルが見つかりません: ${ctx.configPath}`);
  }
  assertPreflight(ctx);
  return ctx;
}

/**
 * 生成カテゴリを `--only` で絞り、絞られて生成しないカテゴリを知らせる
 * @param {Record<string, boolean>} gen generateFiles または手動選択
 * @param {string[] | null} only
 */
export function narrowTargets(ctx, gen, only, io = console) {
  const { gen: narrowed, skipped } = narrowGenerateTargets(gen, only ?? null);
  if (skipped.length > 0) {
    io.log(`[${ctx.camel}] generateFiles で無効のためスキップ: ${skipped.join(", ")}`);
  }
  return narrowed;
}

/**
 * @param {import("../domain/context.mjs").DomainContext} ctx
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {Record<string, boolean>} gen 生成するカテゴリ
 * @param {{ deferServiceRegistry?: boolean, io?: { log: Function, warn: Function } }} [options]
 *   deferServiceRegistry = 一括生成が全ドメインの domainEntry.ts を書いた後に serviceRegistry.ts を 1 回だけ作り直す
 *   （ドメインごとに作り直すと、まだ domainEntry.ts の無い他のドメインで検査が止まるため）
 * @returns {{ registry: boolean }} registry カテゴリを生成したか
 */
export function generateDomain(ctx, workspace, gen, { deferServiceRegistry = false, io = console } = {}) {
  const outputs = planDomain(ctx, workspace, gen);
  applyOutputs(outputs, io);
  if (gen.registry && !deferServiceRegistry) {
    regenerateServiceRegistry(workspace, { errorPrefix: "✗ " });
  }
  return { registry: Boolean(gen.registry) };
}
