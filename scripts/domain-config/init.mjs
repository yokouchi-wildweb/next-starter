#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import askName from "./questions/name.mjs";
import askBasics from "./questions/basics.mjs";
import askRelations from "./questions/relations.mjs";
import askBaseFields from "./questions/base-fields.mjs";
import askFields from "./questions/fields.mjs";
import askCompositeUniques from "./questions/composite-uniques.mjs";
import askViewConfig from "./questions/view-config.mjs";
import askGenerateFiles from "./questions/generate-files.mjs";
import { toCamelCase } from "../../src/utils/stringCase.mjs";
import formatDomainConfig from "./utils/formatConfig.mjs";
import { DOMAIN_CONFIG_VERSION } from "./version.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export default async function init() {
  const config = {};
  config.domainConfigVersion = DOMAIN_CONFIG_VERSION;
  Object.assign(config, await askName());
  Object.assign(config, await askBasics());
  Object.assign(config, await askRelations(config));
  Object.assign(config, await askBaseFields());
  Object.assign(config, await askFields(config));
  Object.assign(config, await askCompositeUniques(config));
  Object.assign(config, await askViewConfig(config));
  Object.assign(config, await askGenerateFiles());

  const rootDir = path.resolve(__dirname, "..", "..");
  const featureDir = toCamelCase(config.singular) || config.singular;
  const dir = path.join(rootDir, "src", "features", featureDir);
  ensureDir(dir);
  const file = path.join(dir, "domain.json");
  fs.writeFileSync(file, formatDomainConfig(config));
  console.log(`設定ファイルを作成しました: ${file}`);
  return config.singular;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  init().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
