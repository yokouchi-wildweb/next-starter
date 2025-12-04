#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import inquirer from "inquirer";
import askGenerateFiles from "./questions/generate-files.mjs";
import { toCamelCase, toSnakeCase } from "../../src/utils/stringCase.mjs";
import formatDomainConfig from "./utils/formatConfig.mjs";
import { DOMAIN_CONFIG_VERSION } from "./version.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const prompt = inquirer.createPromptModule();

const ALL_GENERATE_OPTIONS = {
  entities: true,
  components: true,
  hooks: true,
  clientServices: true,
  serverServices: true,
  fieldConstants: true,
  adminRoutes: true,
  registry: true,
  presenters: true,
};

function runGenerator(script, domain, plural, dbEngine) {
  const scriptPath = path.join(__dirname, "generator", script);
  const args = [scriptPath, domain];
  if (plural) args.push("--plural", plural);
  if (dbEngine) args.push("--dbEngine", dbEngine);
  spawnSync("node", args, { stdio: "inherit" });
}

async function resolveGenerateTargets(config, configPath, options = {}) {
  const currentGenerate = config.generateFiles || {};
  const {
    mode,
    interactive = true,
    manualGenerate,
    saveManualSelection = false,
  } = options;

  if (mode === "config") {
    return currentGenerate;
  }

  if (mode === "all") {
    return ALL_GENERATE_OPTIONS;
  }

  if (mode === "manual" && manualGenerate) {
    if (saveManualSelection) {
      config.generateFiles = manualGenerate;
      fs.writeFileSync(configPath, `${formatDomainConfig(config)}\n`);
      console.log(`更新しました: ${configPath}`);
    }
    return manualGenerate;
  }

  if (!interactive) {
    return currentGenerate;
  }

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

  if (resolvedMode === "config") {
    return currentGenerate;
  }

  if (resolvedMode === "all") {
    return ALL_GENERATE_OPTIONS;
  }

  // manual selection via prompt
  const manualSelection = await askGenerateFiles();
  const manualResult = manualSelection.generateFiles;

  const { shouldSave } = await prompt({
    type: "confirm",
    name: "shouldSave",
    message: "選択内容を domain.json に保存しますか?",
    default: true,
  });

  if (shouldSave) {
    config.generateFiles = manualResult;
    fs.writeFileSync(configPath, `${formatDomainConfig(config)}\n`);
    console.log(`更新しました: ${configPath}`);
  }

  return manualResult;
}

export default async function generate(domain, options = {}) {
  const input = (domain || "").trim();
  if (!input) {
    console.error("ドメイン名を指定してください。");
    return;
  }
  const camel = toCamelCase(input) || input;
  const configPath = path.join(rootDir, "src", "features", camel, "domain.json");
  if (!fs.existsSync(configPath)) {
    console.error(`設定ファイルが見つかりません: ${configPath}`);
    return;
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.domainConfigVersion = DOMAIN_CONFIG_VERSION;
  if (config.version) {
    delete config.version;
  }
  const normalizedDomain = toSnakeCase(config.singular) || toSnakeCase(input) || camel;
  const normalizedPlural = toSnakeCase(config.plural || "") || "";
  const gen = await resolveGenerateTargets(config, configPath, options);

  let shouldGenerate = options.shouldGenerate;
  if (typeof shouldGenerate !== "boolean") {
    ({ shouldGenerate } = await prompt({
      type: "confirm",
      name: "shouldGenerate",
      message: "既存の関係ファイルはすべて上書きされます。生成を実行しますか？",
      default: false,
    }));
  }
  if (!shouldGenerate) {
    console.log("ファイル生成をスキップしました。");
    return;
  }

  const hasOptionFields = (config.fields || []).some(
    (field) => Array.isArray(field.options) && field.options.length > 0,
  );

  if (gen.components)
    runGenerator(path.join("components", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.hooks) runGenerator("generate-hooks.mjs", normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.clientServices)
    runGenerator("generate-client-service.mjs", normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.serverServices)
    runGenerator("generate-server-service.mjs", normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.fieldConstants && hasOptionFields)
    runGenerator(path.join("fields", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.adminRoutes)
    runGenerator(path.join("admin-routes", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.entities)
    runGenerator(path.join("entities", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.registry) runGenerator("registry/index.mjs", normalizedDomain);
  if (gen.presenters)
    runGenerator(path.join("components", "presenters.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const domain = process.argv[2];
  if (!domain) {
    console.error("使い方: node scripts/domain-config/generate.mjs <Domain>");
    process.exit(1);
  }
  try {
    await generate(domain);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
