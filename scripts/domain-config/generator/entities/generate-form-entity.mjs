#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Form entity generator
// Usage:
//   node scripts/domain-config/generator/generate-form-entity.mjs <Domain>

const args = process.argv.slice(2);
const domain = args[0];

if (!domain) {
  console.error('使い方: node scripts/domain-config/generator/generate-form-entity.mjs <Domain>');
  process.exit(1);
}

const camel = domain.charAt(0).toLowerCase() + domain.slice(1);
const pascal = domain.charAt(0).toUpperCase() + domain.slice(1);

const configPath = path.join(process.cwd(), 'src', 'features', camel, 'domain.json');
const outputDir = path.join(process.cwd(), 'src', 'features', camel, 'entities');
const outputFile = path.join(outputDir, 'form.ts');

if (!fs.existsSync(configPath)) {
  console.error(`設定ファイルが見つかりません: ${configPath}`);
  process.exit(1);
}


if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

let content = `// src/features/${camel}/entities/form.ts\n\n`;
content += `import { z } from "zod";\n`;
content += `import { ${pascal}CreateSchema, ${pascal}UpdateSchema } from "./schema";\n\n`;
content += `export type ${pascal}CreateAdditional = {\n  // foo: string; \u30d5\u30a9\u30fc\u30e0\u306b\u8ffd\u52a0\u3059\u308b\u9805\u76ee\n};\n`;
content += `export type ${pascal}CreateFields = z.infer<typeof ${pascal}CreateSchema> & ${pascal}CreateAdditional;\n\n`;
content += `export type ${pascal}UpdateAdditional = {\n  // foo: string; \u30d5\u30a9\u30fc\u30e0\u306b\u8ffd\u52a0\u3059\u308b\u9805\u76ee\n};\n`;
content += `export type ${pascal}UpdateFields = z.infer<typeof ${pascal}UpdateSchema> & ${pascal}UpdateAdditional;\n`;

fs.writeFileSync(outputFile, content);
console.log(`フォームエンティティを生成しました: ${outputFile}`);
