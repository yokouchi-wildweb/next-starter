#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { toCamelCase, toPascalCase, toSnakeCase } from '../../../../src/utils/stringCase.mjs';

// Entity model generator
// Usage:
//   node scripts/domain-config/generator/entities/generate-model-entity.mjs <Domain>

const args = process.argv.slice(2);
const domain = args[0];

if (!domain) {
  console.error('使い方: node scripts/domain-config/generator/entities/generate-model-entity.mjs <Domain>');
  process.exit(1);
}

const normalized = toSnakeCase(domain) || domain;
const camel = toCamelCase(normalized) || normalized;
const pascal = toPascalCase(normalized) || normalized;

const configPath = path.join(process.cwd(), 'src', 'features', camel, 'domain.json');
const outputDir = path.join(process.cwd(), 'src', 'features', camel, 'entities');
const outputFile = path.join(outputDir, 'model.ts');

if (!fs.existsSync(configPath)) {
  console.error(`設定ファイルが見つかりません: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function mapTsType(t) {
  switch (t) {
    case 'string':
    case 'email':
    case 'password':
    case 'uuid':
    case 'date':
    case 'time':
    case 'imageUploader':
      return 'string';
    case 'integer':
    case 'number':
    case 'bigint':
    case 'numeric(10,2)':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'string[]';
    case 'timestamp':
    case 'timestamp With Time Zone':
      return 'Date';
    case 'jsonb':
      return 'any';
    default:
      return 'any';
  }
}

function addField(lines, name, type, required) {
  if (type.endsWith('[]')) {
    lines.push(`  ${name}: ${type};`);
    return;
  }

  const t = required ? type : `${type} | null`;
  lines.push(`  ${name}: ${t};`);
}

const lines = [];
// id field
const idTs = mapTsType(config.idType);
lines.push(`  id: ${idTs};`);

// belongsTo relations
(config.relations || []).forEach((rel) => {
  if (rel.relationType !== 'belongsTo') return;
  const t = mapTsType(rel.fieldType || config.idType);
  addField(lines, rel.fieldName, t, rel.required);
});

// belongsToMany relations
(config.relations || []).forEach((rel) => {
  if (rel.relationType !== 'belongsToMany') return;
  const t = mapTsType(rel.fieldType || config.idType);
  lines.push(`  ${rel.fieldName}?: ${t}[];`);
});

// normal fields
(config.fields || []).forEach((f) => {
  if (f.fieldType === 'enum') {
    const values = (f.options || []).map((o) => `'${o.value}'`).join(' | ');
    addField(lines, f.name, values, f.required);
  } else {
    const t = mapTsType(f.fieldType);
    addField(lines, f.name, t, f.required);
  }
});

if (config.useCreatedAt) lines.push('  createdAt: Date | null;');
if (config.useUpdatedAt) lines.push('  updatedAt: Date | null;');

let content = `// src/features/${camel}/entities/model.ts\n\n`;
content += `export type ${pascal} = {\n`;
content += lines.join('\n');
content += `\n};\n`;

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, content);
console.log(`モデルエンティティを生成しました: ${outputFile}`);
