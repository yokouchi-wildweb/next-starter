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
import { findDomainDirectories } from "./generate-all.mjs";
import { getCliArgs } from "./utils/cliArgs.mjs";
import { checkDomainFolderName } from "./utils/domainFolder.mjs";
import { checkMediaFieldsEngine } from "./utils/mediaFields.mjs";
import { GENERATE_CATEGORIES, narrowGenerateTargets } from "./utils/onlyOption.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const prompt = inquirer.createPromptModule();

const ALL_GENERATE_OPTIONS = Object.fromEntries(GENERATE_CATEGORIES.map((category) => [category, true]));

function runGenerator(script, domain, plural, dbEngine, extraArgs = []) {
  const scriptPath = path.join(__dirname, "generator", script);
  const args = [scriptPath, domain];
  if (plural) args.push("--plural", plural);
  if (dbEngine) args.push("--dbEngine", dbEngine);
  args.push(...extraArgs);
  const result = spawnSync("node", args, { stdio: "inherit" });
  // 個別ジェネレーターの失敗を握りつぶさず、呼び出し側（CLI）の終了コードに伝える
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ジェネレーターが失敗しました（exit ${result.status}）: ${script}`);
  }
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
    throw new Error("ドメイン名を指定してください。");
  }
  const camel = toCamelCase(input) || input;
  const configPath = path.join(rootDir, "src", "features", camel, "domain.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`設定ファイルが見つかりません: ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  // フォルダ名が camel(singular) とずれていると全ジェネレーターが別パスへ書き出すため、何も書く前に止める
  const folderError = checkDomainFolderName(camel, config);
  if (folderError) {
    throw new Error(folderError);
  }
  // Firestore ドメインのメディア列は binding を持てないため、何も書く前に止める
  const mediaEngineError = checkMediaFieldsEngine(camel, config);
  if (mediaEngineError) {
    throw new Error(mediaEngineError);
  }
  config.domainConfigVersion = DOMAIN_CONFIG_VERSION;
  if (config.version) {
    delete config.version;
  }
  const normalizedDomain = toSnakeCase(config.singular) || toSnakeCase(input) || camel;
  const normalizedPlural = toSnakeCase(config.plural || "") || "";
  // options.only（--only）は generateFiles を広げず、true のカテゴリを絞り込むだけ
  const { gen, skipped } = narrowGenerateTargets(await resolveGenerateTargets(config, configPath, options), options.only ?? null);
  if (skipped.length > 0) {
    console.log(`[${camel}] generateFiles で無効のためスキップ: ${skipped.join(", ")}`);
  }

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
    return { registry: false };
  }

  const hasOptionFields = (config.fields || []).some(
    (field) => Array.isArray(field.options) && field.options.length > 0,
  );

  if (gen.components)
    runGenerator(path.join("components", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.hooks) runGenerator(path.join("hooks", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
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
  // deferServiceRegistry = 一括生成（generate-all）が全ドメインの domainEntry.ts を書いた後に serviceRegistry.ts を 1 回だけ作り直す
  if (gen.registry)
    runGenerator("registry/index.mjs", normalizedDomain, undefined, undefined, options.deferServiceRegistry ? ["--defer-service-registry"] : []);
  if (gen.presenters)
    runGenerator(path.join("components", "presenters.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  return { registry: Boolean(gen.registry) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let domain = getCliArgs()[0];
  if (!domain) {
    const domains = findDomainDirectories();
    if (domains.length === 0) {
      console.error("domain.json を含むドメインが存在しません。");
      process.exit(1);
    }
    const { selectedDomain } = await prompt({
      type: "list",
      name: "selectedDomain",
      message: "生成するドメインを選択してください:",
      choices: domains.map((d) => ({ name: d, value: d })),
      loop: false,
    });
    domain = selectedDomain;
  }
  try {
    await generate(domain);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
