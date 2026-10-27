// dc:generate <Domain>: 生成方法の選択（domain.json どおり / 手動選択 / 全部）と上書き確認をしてから pipeline に渡す

import fs from "node:fs";
import askGenerateFiles from "../questions/generate-files.mjs";
import formatDomainConfig from "../spec/format.mjs";
import { ALL_GENERATE_OPTIONS } from "../spec/categories.mjs";
import { DOMAIN_CONFIG_VERSION } from "../spec/version.mjs";
import { generateDomain, loadDomainForGenerate, narrowTargets } from "../pipeline/generate.mjs";
import { confirm, prompt } from "./prompts.mjs";

/** 手動選択を domain.json に保存する（形式のバージョンも最新に揃える） */
function saveGenerateFiles(ctx, generateFiles) {
  const config = { ...ctx.config, generateFiles };
  config.domainConfigVersion = DOMAIN_CONFIG_VERSION;
  delete config.version;
  fs.writeFileSync(ctx.configPath, `${formatDomainConfig(config)}\n`);
  console.log(`更新しました: ${ctx.configPath}`);
}

/**
 * 生成するカテゴリを決める
 * @param {{ mode?: "config" | "manual" | "all", interactive?: boolean, manualGenerate?: Record<string, boolean>, saveManualSelection?: boolean }} options
 */
async function resolveGenerateTargets(ctx, options) {
  const currentGenerate = ctx.config.generateFiles || {};
  const { mode, interactive = true, manualGenerate, saveManualSelection = false } = options;

  if (mode === "config") return currentGenerate;
  if (mode === "all") return ALL_GENERATE_OPTIONS;
  if (mode === "manual" && manualGenerate) {
    if (saveManualSelection) saveGenerateFiles(ctx, manualGenerate);
    return manualGenerate;
  }
  if (!interactive) return currentGenerate;

  const { mode: resolvedMode } = await prompt({
    type: "list",
    name: "mode",
    message: "生成方法を選択:",
    choices: [
      { name: "domain.json の設定に基づいて生成", value: "config" },
      { name: "生成カテゴリを手動で選択", value: "manual" },
      { name: "すべてのファイルを生成", value: "all" },
    ],
    default: "config",
  });
  if (resolvedMode === "config") return currentGenerate;
  if (resolvedMode === "all") return ALL_GENERATE_OPTIONS;

  const { generateFiles: manualResult } = await askGenerateFiles();
  if (await confirm("選択内容を domain.json に保存しますか?", true)) {
    saveGenerateFiles(ctx, manualResult);
  }
  return manualResult;
}

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string} domain
 * @param {{ mode?: string, interactive?: boolean, shouldGenerate?: boolean, only?: string[] | null, manualGenerate?: object, saveManualSelection?: boolean }} [options]
 *   --yes = { mode: "config", interactive: false, shouldGenerate: true }
 */
export async function runGenerate(workspace, domain, options = {}) {
  const ctx = loadDomainForGenerate(workspace, domain);
  const gen = narrowTargets(ctx, await resolveGenerateTargets(ctx, options), options.only ?? null);

  let { shouldGenerate } = options;
  if (typeof shouldGenerate !== "boolean") {
    shouldGenerate = await confirm("既存の関係ファイルはすべて上書きされます。生成を実行しますか？", false);
  }
  if (!shouldGenerate) {
    console.log("ファイル生成をスキップしました。");
    return { registry: false };
  }
  return generateDomain(ctx, workspace, gen);
}
