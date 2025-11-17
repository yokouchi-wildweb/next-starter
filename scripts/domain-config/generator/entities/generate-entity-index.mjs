#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Entity index generator
// Usage:
//   node scripts/domain-config/generator/entities/generate-entity-index.mjs <Domain> [--dbEngine <DB>]

const args = process.argv.slice(2);
const domain = args[0];

let dbEngineArg;
const dbIndex = args.findIndex((a) => a === '--dbEngine' || a === '-d');
if (dbIndex !== -1) {
  dbEngineArg = args[dbIndex + 1];
}

if (!domain) {
  console.error('使い方: node scripts/domain-config/generator/entities/generate-entity-index.mjs <Domain>');
  process.exit(1);
}

const camel = domain.charAt(0).toLowerCase() + domain.slice(1);

const configPath = path.join(process.cwd(), 'src', 'features', camel, 'domain.json');
const outputDir = path.join(process.cwd(), 'src', 'features', camel, 'entities');
const outputFile = path.join(outputDir, 'index.ts');

if (!dbEngineArg && fs.existsSync(configPath)) {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  dbEngineArg = cfg.dbEngine;
}

const lines = [`// src/features/${camel}/entities/index.ts`, ''];
lines.push('export * from "./model";');
if (dbEngineArg === 'Firestore') {
  lines.push('export * from "./firestore";');
} else {
  lines.push('export * from "./drizzle";');
}
lines.push('export * from "./schema";');
lines.push('export * from "./form";');

const content = `${lines.join('\n')}\n`;

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, content);
console.log(`エンティティ索引を生成しました: ${outputFile}`);
