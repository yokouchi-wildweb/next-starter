// 1 ドメインの生成: 読む（context）→ 検査（checks）→ 作る（plan）→ 登録表の事前検査 → 書く（apply）→ serviceRegistry を作り直す。
// 対話（生成方法の選択・上書き確認）は cli/generate.mjs。ここは --yes でも対話でも同じ

import { assertPreflight, preflightWarnings } from "../checks/index.mjs";
import { createDomainContext } from "../domain/context.mjs";
import { narrowGenerateTargets } from "../spec/categories.mjs";
import { applyOutputs } from "./apply.mjs";
import { reportDryRun, summarizeDryRun } from "./dryRun.mjs";
import { planDomain } from "./plan.mjs";
import { precheckServiceRegistry, regenerateServiceRegistry } from "./serviceRegistry.mjs";

/**
 * domain.json を読み、生成前の検査を通す。フォルダ名のずれ・Firestore のメディア列は何も書く前に止める。
 * 語彙のずれ（綴り違い・古いキー・その DB に無い型）は警告して続ける
 * @returns {import("../domain/context.mjs").DomainContext}
 */
export function loadDomainForGenerate(workspace, domainInput, io = console) {
  const input = (domainInput || "").trim();
  if (!input) {
    throw new Error("ドメイン名を指定してください。");
  }
  const ctx = createDomainContext(workspace, input);
  if (!ctx.config) {
    throw new Error(`設定ファイルが見つかりません: ${ctx.configPath}`);
  }
  assertPreflight(ctx);
  for (const warning of preflightWarnings(ctx)) io.warn(warning);
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
 * @param {{ deferServiceRegistry?: boolean, dryRun?: boolean, io?: { log: Function, warn: Function } }} [options]
 *   deferServiceRegistry = 一括生成が全ドメインの domainEntry.ts を書いた後に serviceRegistry.ts を 1 回だけ作り直す
 *   （ドメインごとに作り直すと、まだ domainEntry.ts の無い他のドメインで検査が止まるため）
 *   dryRun = 書かずに、書くはずのファイルと動作（作成 / 上書き / 変更なし / 保持 / 移行）を一覧する
 * @returns {{ registry: boolean }} registry カテゴリを生成したか
 */
export function generateDomain(ctx, workspace, gen, { deferServiceRegistry = false, dryRun = false, io = console } = {}) {
  const outputs = planDomain(ctx, workspace, gen);
  if (dryRun) {
    const counts = reportDryRun(outputs, workspace, io);
    io.log(`[dry-run] ${ctx.camel}: ${summarizeDryRun(counts) || "書くものなし"}${gen.registry ? "（serviceRegistry.ts は実行時に作り直す）" : ""}`);
    return { registry: Boolean(gen.registry) };
  }
  // 登録表が作れない状態（手書き行・他ドメインの domainEntry.ts 欠け）なら、何も書かずに止める
  if (gen.registry && !deferServiceRegistry) {
    precheckServiceRegistry(workspace, outputs, { errorPrefix: "✗ " });
  }
  applyOutputs(outputs, io);
  if (gen.registry && !deferServiceRegistry) {
    regenerateServiceRegistry(workspace, { errorPrefix: "✗ " });
  }
  return { registry: Boolean(gen.registry) };
}
