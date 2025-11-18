#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { toCamelCase, toSnakeCase } from "../../src/utils/stringCase.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

function runGenerator(script, domain, plural, dbEngine) {
  const scriptPath = path.join(__dirname, "generator", script);
  const args = [scriptPath, domain];
  if (plural) args.push("--plural", plural);
  if (dbEngine) args.push("--dbEngine", dbEngine);
  spawnSync("node", args, { stdio: "inherit" });
}

export default async function generate(domain) {
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
  const normalizedDomain = toSnakeCase(config.singular) || toSnakeCase(input) || camel;
  const normalizedPlural = toSnakeCase(config.plural || "") || "";
  const gen = config.generateFiles || {};

  if (gen.components)
    runGenerator(path.join("components", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.hooks) runGenerator("generate-hooks.mjs", normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.clientServices)
    runGenerator("generate-client-service.mjs", normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.serverServices)
    runGenerator("generate-server-service.mjs", normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.adminRoutes)
    runGenerator(path.join("admin-routes", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.entities)
    runGenerator(path.join("entities", "index.mjs"), normalizedDomain, normalizedPlural, config.dbEngine);
  if (gen.registry) runGenerator("registry/index.mjs", normalizedDomain);
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
