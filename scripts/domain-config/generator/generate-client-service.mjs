#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { toCamelCase, toPascalCase, toSnakeCase } from '../../../src/utils/stringCase.mjs';

//
// Client service generator
//
// Usage:
//   node scripts/domain-generator/generate-client-service.mjs <domain>
//
// <domain> can be snake_case/camelCase/PascalCase.
// The script creates src/features/<domain>/services/client/<domain>Client.ts
// from the template located at src/features/_template/services/client/__domain__Client.ts.

const args = process.argv.slice(2);
const domain = args[0];

// ドメイン名が渡されていない場合は使い方を表示して終了
if (!domain) {
  console.error('使い方: node scripts/domain-generator/generate-client-service.mjs <domain>');
  process.exit(1);
}

const normalized = toSnakeCase(domain) || domain;
const camel = toCamelCase(normalized) || normalized;
const pascal = toPascalCase(normalized) || normalized;

const templatePath = path.join(
  process.cwd(),
  'src',
  'features',
  '_template',
  'services',
  'client',
  '__domain__Client.ts'
);
const outputDir = path.join(process.cwd(), 'src', 'features', camel, 'services', 'client');
const outputFile = path.join(outputDir, `${camel}Client.ts`);

// テンプレートファイルが存在するかを確認し、無ければエラー終了
if (!fs.existsSync(templatePath)) {
  console.error(`テンプレートが見つかりません: ${templatePath}`);
  process.exit(1);
}

// 出力先ディレクトリが存在しない場合は作成する
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const template = fs.readFileSync(templatePath, 'utf8');
const content = template
  .replace(/__domain__/g, camel)
  .replace(/__Domain__/g, pascal);

fs.writeFileSync(outputFile, content);
console.log(`クライアントサービスを生成しました: ${outputFile}`);
