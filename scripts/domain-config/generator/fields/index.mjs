#!/usr/bin/env node
import fs from "fs";
import path from "path";

import buildConstants from "./buildConstants.mjs";
import buildTypes from "./buildTypes.mjs";
import { toCamelCase, toPascalCase } from "../../../../src/utils/stringCase.mjs";

const args = process.argv.slice(2);
const domain = args[0];

if (!domain) {
  console.error("使い方: node scripts/domain-config/generator/fields/index.mjs <Domain>");
  process.exit(1);
}

const camel = toCamelCase(domain) || domain;
const pascalDomain = toPascalCase(domain) || domain;

const configPath = path.join(process.cwd(), "src", "features", camel, "domain.json");
if (!fs.existsSync(configPath)) {
  console.error(`設定ファイルが見つかりません: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const optionFields = (config.fields || []).filter(
  (field) => Array.isArray(field.options) && field.options.length > 0,
);

if (!optionFields.length) {
  process.exit(0);
}

const fieldMeta = optionFields.map((field) => {
  const pascalField = toPascalCase(field.name) || field.name;
  return {
    name: field.name,
    constantName: `${pascalDomain}${pascalField}Options`,
    optionTypeName: `${pascalDomain}${pascalField}Option`,
    valueTypeName: `${pascalDomain}${pascalField}Value`,
    labelTypeName: `${pascalDomain}${pascalField}Label`,
    options: field.options.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  };
});

const featureDir = path.join(process.cwd(), "src", "features", camel);
const constantDir = path.join(featureDir, "constants");
const typeDir = path.join(featureDir, "types");
const constantPath = path.join(constantDir, "field.ts");
const typePath = path.join(typeDir, "field.ts");
const constantRelPath = path.posix.join("src", "features", camel, "constants", "field.ts");
const typeRelPath = path.posix.join("src", "features", camel, "types", "field.ts");

fs.mkdirSync(constantDir, { recursive: true });
fs.mkdirSync(typeDir, { recursive: true });

const constantSource = buildConstants(fieldMeta, constantRelPath);
const typeSource = buildTypes(fieldMeta, typeRelPath);

fs.writeFileSync(constantPath, constantSource);
fs.writeFileSync(typePath, typeSource);

console.log(`フィールド定数を生成しました: ${constantPath}`);
console.log(`フィールド型を生成しました: ${typePath}`);
