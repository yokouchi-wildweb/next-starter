#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";
import { resolveFeaturePath, resolveFeatureTemplatePath } from "./utils/pathHelpers.mjs";

/**
 * クライアントサービスを生成する
 * @param {string} domain - ドメイン名（snake_case, camelCase, PascalCase のいずれか）
 */
export default function generateClientService(domain) {
  const normalized = toSnakeCase(domain) || domain;
  const camel = toCamelCase(normalized) || normalized;
  const pascal = toPascalCase(normalized) || normalized;

  const templatePath = resolveFeatureTemplatePath("services", "client", "__domain__Client.ts");
  const outputDir = path.join(resolveFeaturePath(camel), "services", "client");
  const outputFile = path.join(outputDir, `${camel}Client.ts`);

  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const content = template
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal);

  fs.writeFileSync(outputFile, content);
  console.log(`クライアントサービスを生成しました: ${outputFile}`);
}

// CLI実行時
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const domain = process.argv[2];

  if (!domain) {
    console.error("使い方: node scripts/domain-config/generator/generate-client-service.mjs <domain>");
    process.exit(1);
  }

  generateClientService(domain);
}
