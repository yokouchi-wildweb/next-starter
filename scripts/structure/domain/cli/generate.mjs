// pnpm generate domain -- <Domain>: 生成方法の選択（entity.json の generate どおり / 手動選択 / 全部）と上書き確認をしてから pipeline に渡す。
// 生成の単位はドメインの中の登録 1 件(D336): ドメインの生成する登録ごとに(主が先)同じ手順を回す

import { pickCategories } from "./pickCategories.mjs";
import { ALL_GENERATE_OPTIONS, isHandManaged } from "../spec/categories.mjs";
import { configTargets, generateWithPairs, loadDomainForGenerate, narrowTargets } from "../pipeline/generate.mjs";
import { assertPairs, groupOf, resolvePairs } from "../pipeline/pairs.mjs";
import { confirm, prompt } from "./prompts.mjs";
import { toCamelCase, toSnakeCase } from "../../../../src/lib/stringCase/index.mjs";

/**
 * 生成するカテゴリを決める（--only で絞った後）。手動選択は entity.json に保存しない（区分は entity.json に持たない）
 * @param {import("../pipeline/pairs.mjs").PairIndex} pairs
 * @param {{ mode?: "config" | "manual" | "all", interactive?: boolean, manualGenerate?: Record<string, boolean>, only?: string[] | null }} options
 */
async function resolveGenerateTargets(ctx, pairs, options) {
  const { mode, interactive = true, manualGenerate } = options;
  const only = options.only ?? null;
  const fromConfig = () => configTargets(ctx, pairs, only);
  // 多対多の結びの登録は手動選択でも表のファイルだけ(D354)
  const limit = { junction: pairs.junctions.has(ctx.camel) };

  if (mode === "config") return fromConfig();
  if (mode === "all") return narrowTargets(ctx, ALL_GENERATE_OPTIONS, only, console, limit);
  if (mode === "manual" && manualGenerate) return narrowTargets(ctx, manualGenerate, only, console, limit);
  if (!interactive) return fromConfig();

  const { mode: resolvedMode } = await prompt({
    type: "list",
    name: "mode",
    message: "生成方法を選択:",
    choices: [
      { name: "entity.json の generate に基づいて生成", value: "config" },
      { name: "生成カテゴリを手動で選択（保存しない）", value: "manual" },
      { name: "すべてのファイルを生成", value: "all" },
    ],
    default: "config",
  });
  if (resolvedMode === "config") return fromConfig();
  if (resolvedMode === "all") return narrowTargets(ctx, ALL_GENERATE_OPTIONS, only, console, limit);

  return narrowTargets(ctx, await pickCategories(), only, console, limit);
}

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string} domain
 * @param {{ mode?: string, interactive?: boolean, shouldGenerate?: boolean, only?: string[] | null, dryRun?: boolean, manualGenerate?: object }} [options]
 *   --yes = { mode: "config", interactive: false, shouldGenerate: true } | --dry-run = 書かずに一覧（上書き確認も出さない）
 */
export async function runGenerate(workspace, domain, options = {}) {
  const folder = toCamelCase(toSnakeCase(domain.trim()) || domain.trim()) || domain.trim();
  // 従属の登録(主の集まりの項目の相手、D334)は主の単位が組で生成するので、主が同じドメインで生成されるなら単位に数えない
  const pairs = resolvePairs(workspace);
  const all = workspace.generationUnitsOf(folder);
  const units = all.filter((registration) => !all.includes(pairs.ownerOf.get(registration) ?? ""));
  // 表 1 つのドメイン(登録名 = ドメイン名)と宣言の無いドメインは今までどおり 1 回
  if (units.length <= 1 && (units.length === 0 || units[0] === folder)) return runGenerateUnit(workspace, domain, null, true, options);
  let registry = false;
  for (const [index, registration] of units.entries()) {
    console.log(`\n[${folder}/${registration}] 登録 ${registration} の一式を生成します。`);
    const result = await runGenerateUnit(workspace, domain, registration, index === 0, options);
    registry = registry || Boolean(result?.registry);
  }
  return { registry };
}

/**
 * 生成の単位 1 件(ドメインの中の登録 1 件)の pnpm generate domain
 * @param {string | null} registration 登録名(null = ドメインの主の登録)
 */
async function runGenerateUnit(workspace, domain, registration, firstUnit, options) {
  const ctx = loadDomainForGenerate(workspace, domain, console, registration ? { registration, firstUnit } : {});
  // 手で管理（generate: false）は -i でも生成方法を聞かずに終える（生成器を一切通さない）
  if (isHandManaged(ctx.config)) {
    console.log(`[${ctx.camel}] generate: false（手で管理）のため何も書きません（作り直すときは generate を true に戻す）`);
    return { registry: false };
  }
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
