#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../../src/utils/stringCase.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const domain = args[0];

let pluralArg;
const pluralIndex = args.findIndex((a) => a === "--plural" || a === "-p");
if (pluralIndex !== -1) {
  pluralArg = args[pluralIndex + 1];
}

if (!domain) {
  console.error("使い方: node scripts/domain-config/generator/components/presenters.mjs <Domain> [--plural <plural>]");
  process.exit(1);
}

const camel = toCamelCase(domain) || domain;
const pascal = toPascalCase(domain) || domain;

const featureDir = path.join(process.cwd(), "src", "features", camel);
const configPath = path.join(featureDir, "domain.json");
if (!fs.existsSync(configPath)) {
  console.error(`domain.json が見つかりません: ${configPath}`);
  process.exit(1);
}

const templatePath = path.join(process.cwd(), "src", "features", "_template", "presenters.ts");
if (!fs.existsSync(templatePath)) {
  console.error(`テンプレートが見つかりません: ${templatePath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const buildOptionsMap = (options = []) => {
  return options
    .map((opt) => `"${String(opt.value)}": "${opt.label ?? opt.value}"`)
    .join(", ");
};

const buildFormatter = (field) => {
  const { fieldType, formInput, options } = field;
  switch (fieldType) {
    case "boolean":
      return `formatBoolean(value, "はい", "いいえ")`;
    case "integer":
    case "number":
    case "float":
      return `formatNumber(value)`;
    case "array":
      return `formatStringArray(value)`;
    case "enum":
      if (Array.isArray(options) && options.length) {
        return `formatEnumLabel(value, { ${buildOptionsMap(options)} })`;
      }
      return `formatString(value)`;
    default:
      break;
  }

  if (formInput === "numberInput" || formInput === "stepperInput") {
    return `formatNumber(value)`;
  }
  if (formInput === "textarea" || formInput === "textInput") {
    return `formatString(value)`;
  }
  if (formInput === "datetimeInput") {
    return `formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`;
  }
  if (formInput === "dateInput") {
    return `formatDateValue(value, "YYYY/MM/DD", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`;
  }
  // mediaUploader / fileUploader は renderValue のフォールバック処理で画像表示するため除外
  if (formInput === "mediaUploader" || formInput === "fileUploader") {
    return null;
  }

  return `formatString(value)`;
};

const presenterEntries = (config.fields ?? [])
  .map((field) => {
    const formatter = buildFormatter(field);
    // formatter が null の場合は除外（renderValue にフォールバックさせる）
    if (formatter === null) {
      return null;
    }
    return `  ${field.name}: ({ value, field, record }) => ${formatter},`;
  })
  .filter((entry) => entry !== null);

if (config.useCreatedAt) {
  presenterEntries.push(
    `  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),`,
  );
}
if (config.useUpdatedAt) {
  presenterEntries.push(
    `  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),`,
  );
}

const body = presenterEntries.length ? presenterEntries.join("\n") : "  // TODO: add presenters";
const template = fs.readFileSync(templatePath, "utf8");
const content = template
  .replace(/__domain__/g, toCamelCase(config.singular) || camel)
  .replace(/__Domain__/g, toPascalCase(config.singular) || pascal)
  .replace(/__PRESENTERS_BODY__/g, body);

const outputPath = path.join(featureDir, "presenters.ts");
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, `${content}\n`);
console.log(`presenters.ts を生成しました: ${outputPath}`);
