#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { toCamelCase, toPascalCase, toSnakeCase, toPlural } from '../../../../src/utils/stringCase.mjs';

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
    case 'mediaUploader':
      return 'string';
    case 'integer':
    case 'number':
    case 'bigint':
    case 'float':
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
  if (rel.relationType !== 'belongsToMany' || rel.includeRelationTable === false) return;
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

// リレーション情報を収集
const belongsToRelations = (config.relations || []).filter(
  (rel) => rel.relationType === 'belongsTo'
);
const belongsToManyRelations = (config.relations || []).filter(
  (rel) => rel.relationType === 'belongsToMany' && rel.includeRelationTable !== false
);
const hasRelations = belongsToRelations.length > 0 || belongsToManyRelations.length > 0;
const hasCountable = belongsToManyRelations.length > 0;

// リレーション先の型インポートを生成
function buildRelationTypeImports() {
  const imports = [];
  const addedDomains = new Set();

  belongsToRelations.forEach((rel) => {
    if (addedDomains.has(rel.domain)) return;
    addedDomains.add(rel.domain);
    const relCamel = toCamelCase(rel.domain);
    const relPascal = toPascalCase(rel.domain);
    imports.push(`import type { ${relPascal} } from "@/features/${relCamel}/entities/model";`);
  });

  belongsToManyRelations.forEach((rel) => {
    if (addedDomains.has(rel.domain)) return;
    addedDomains.add(rel.domain);
    const relCamel = toCamelCase(rel.domain);
    const relPascal = toPascalCase(rel.domain);
    imports.push(`import type { ${relPascal} } from "@/features/${relCamel}/entities/model";`);
  });

  return imports.join('\n');
}

// WithRelations 型を生成
function buildWithRelationsType() {
  if (!hasRelations) return '';

  const fields = [];

  belongsToRelations.forEach((rel) => {
    const relPascal = toPascalCase(rel.domain);
    // field名: sample_category_id → sample_category
    const fieldName = rel.fieldName.replace(/_id$/, '');
    fields.push(`  /** belongsTo: ${rel.label || rel.domain} */`);
    fields.push(`  ${fieldName}?: ${relPascal} | null;`);
  });

  belongsToManyRelations.forEach((rel) => {
    const relPascal = toPascalCase(rel.domain);
    // field名: 複数形（sample_tag → sample_tags）
    const fieldName = toPlural(rel.domain);
    fields.push(`  /** belongsToMany: ${rel.label || rel.domain} */`);
    fields.push(`  ${fieldName}?: ${relPascal}[];`);
  });

  return `
/**
 * リレーション展開済みの ${pascal} 型。
 * withRelations: true オプション使用時に返される。
 */
export type ${pascal}WithRelations = ${pascal} & {
${fields.join('\n')}
};
`;
}

// WithCount 型を生成
function buildWithCountType() {
  if (!hasCountable) return '';

  const countFields = belongsToManyRelations.map((rel) => {
    // field名: 複数形（sample_tag → sample_tags）
    const fieldName = toPlural(rel.domain);
    return `    /** ${rel.label || rel.domain}の数 */\n    ${fieldName}: number;`;
  });

  return `
/**
 * カウント付きの ${pascal} 型。
 * withCount: true オプション使用時に返される。
 */
export type ${pascal}WithCount = ${pascal} & {
  _count: {
${countFields.join('\n')}
  };
};
`;
}

// WithRelationsAndCount 型を生成
function buildWithRelationsAndCountType() {
  if (!hasRelations && !hasCountable) return '';
  if (!hasRelations) return '';
  if (!hasCountable) return '';

  return `
/**
 * リレーション展開 + カウント付きの ${pascal} 型。
 * withRelations: true, withCount: true オプション使用時に返される。
 */
export type ${pascal}WithRelationsAndCount = ${pascal}WithRelations & ${pascal}WithCount;
`;
}

// コンテンツを組み立て
let content = `// src/features/${camel}/entities/model.ts\n\n`;

// リレーションがある場合はインポートを追加
const relationImports = buildRelationTypeImports();
if (relationImports) {
  content += relationImports + '\n\n';
}

// 基本型
content += `export type ${pascal} = {\n`;
content += lines.join('\n');
content += `\n};\n`;

// WithRelations 型
content += buildWithRelationsType();

// WithCount 型
content += buildWithCountType();

// WithRelationsAndCount 型
content += buildWithRelationsAndCountType();

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, content);
console.log(`モデルエンティティを生成しました: ${outputFile}`);
