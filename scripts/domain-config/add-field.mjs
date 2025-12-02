#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import askFields from "./questions/fields.mjs";
import formatDomainConfig from "./utils/formatConfig.mjs";
import { toCamelCase } from "../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDomainPath(domain) {
  const featureDir = toCamelCase(domain) || domain;
  return path.join(__dirname, "..", "..", "src", "features", featureDir, "domain.json");
}

async function addField() {
  const args = process.argv.slice(2);
  const domain = args[0];
  if (!domain) {
    console.error("使い方: npm run dc:add -- <Domain>");
    process.exit(1);
  }

  const configPath = resolveDomainPath(domain);
  if (!fs.existsSync(configPath)) {
    console.error(`domain.json が見つかりません: ${configPath}`);
    process.exit(1);
  }

  const currentConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const existingFields = Array.isArray(currentConfig.fields) ? currentConfig.fields : [];

  const addition = await askFields({ ...currentConfig, _fieldIndex: existingFields.length });
  const newFields = addition.fields ?? [];
  if (!newFields.length) {
    console.log("フィールドの追加は行われませんでした。");
    return;
  }

  const nextConfig = {
    ...currentConfig,
    fields: [...existingFields, ...newFields],
  };

  fs.writeFileSync(configPath, formatDomainConfig(nextConfig));
  console.log(`${newFields.length} 件のフィールドを ${configPath} へ追加しました。`);
}

addField().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
