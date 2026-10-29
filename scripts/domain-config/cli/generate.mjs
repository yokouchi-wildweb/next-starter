// dc:generate <Domain>: 生成方法の選択（domain.json どおり / 手動選択 / 全部）と上書き確認をしてから pipeline に渡す

import { pickCategories } from "./pickCategories.mjs";
import { ALL_GENERATE_OPTIONS } from "../spec/categories.mjs";
import { configTargets, generateWithPairs, loadDomainForGenerate, narrowTargets } from "../pipeline/generate.mjs";
import { assertPairs, groupOf, resolvePairs } from "../pipeline/pairs.mjs";
import { confirm, prompt } from "./prompts.mjs";

/**
 * 生成するカテゴリを決める（--only で絞った後）。手動選択は domain.json に保存しない（区分は domain.json に持たない）
 * @param {import("../pipeline/pairs.mjs").PairIndex} pairs
 * @param {{ mode?: "config" | "manual" | "all", interactive?: boolean, manualGenerate?: Record<string, boolean>, only?: string[] | null }} options
 */
async function resolveGenerateTargets(ctx, pairs, options) {
  const { mode, interactive = true, manualGenerate } = options;
  const only = options.only ?? null;
  const fromConfig = () => configTargets(ctx, pairs, only);

  if (mode === "config") return fromConfig();
  if (mode === "all") return narrowTargets(ctx, ALL_GENERATE_OPTIONS, only);
  if (mode === "manual" && manualGenerate) return narrowTargets(ctx, manualGenerate, only);
  if (!interactive) return fromConfig();

  const { mode: resolvedMode } = await prompt({
    type: "list",
    name: "mode",
    message: "生成方法を選択:",
    choices: [
      { name: "domain.json の generate に基づいて生成", value: "config" },
      { name: "生成カテゴリを手動で選択（保存しない）", value: "manual" },
      { name: "すべてのファイルを生成", value: "all" },
    ],
    default: "config",
  });
  if (resolvedMode === "config") return fromConfig();
  if (resolvedMode === "all") return narrowTargets(ctx, ALL_GENERATE_OPTIONS, only);

  return narrowTargets(ctx, await pickCategories(), only);
}

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string} domain
 * @param {{ mode?: string, interactive?: boolean, shouldGenerate?: boolean, only?: string[] | null, dryRun?: boolean, manualGenerate?: object }} [options]
 *   --yes = { mode: "config", interactive: false, shouldGenerate: true } | --dry-run = 書かずに一覧（上書き確認も出さない）
 */
export async function runGenerate(workspace, domain, options = {}) {
  const ctx = loadDomainForGenerate(workspace, domain);
  // 組の誤り（従属の名前が無い・主が 2 つ）は生成方法の選択・上書き確認より前に出す
  const pairs = resolvePairs(workspace);
  assertPairs(pairs, groupOf(pairs, ctx.camel));
  const gen = await resolveGenerateTargets(ctx, pairs, options);

  const only = options.only ?? null;
  if (options.dryRun) {
    return generateWithPairs(ctx, workspace, gen, { only, dryRun: true, pairs });
  }
  let { shouldGenerate } = options;
  if (typeof shouldGenerate !== "boolean") {
    shouldGenerate = await confirm("既存の関係ファイルはすべて上書きされます。生成を実行しますか？", false);
  }
  if (!shouldGenerate) {
    console.log("ファイル生成をスキップしました。");
    return { registry: false };
  }
  return generateWithPairs(ctx, workspace, gen, { only, pairs });
}
