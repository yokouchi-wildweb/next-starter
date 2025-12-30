#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { toCamelCase, toPascalCase, toSnakeCase } from '../../../../src/utils/stringCase.mjs';

//
// Schema generator
//
// Usage:
//   node scripts/domain-config/generator/generate-schema.mjs <Domain>
//
// <Domain> should be the domain name in camelCase or PascalCase.
// The script reads src/features/<domain>/domain.json and outputs
// src/features/<domain>/entities/schema.ts
//
const args = process.argv.slice(2);
const domain = args[0];

if (!domain) {
  console.error('使い方: node scripts/domain-config/generator/generate-schema.mjs <Domain>');
  process.exit(1);
}

const normalized = toSnakeCase(domain) || domain;
const camel = toCamelCase(normalized) || normalized;
const pascal = toPascalCase(normalized) || normalized;

const configPath = path.join(process.cwd(), 'src', 'features', camel, 'domain.json');
const outputDir = path.join(process.cwd(), 'src', 'features', camel, 'entities');
const outputFile = path.join(outputDir, 'schema.ts');

if (!fs.existsSync(configPath)) {
  console.error(`設定ファイルが見つかりません: ${configPath}`);
  process.exit(1);
}


const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const DATETIME_TYPE = `z.preprocess(
  (value) => {
    if (value == null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed;
    }
    return value;
  },
  z.coerce.date()
)`;

function mapZodType(type) {
  switch (type) {
    case 'string':
    case 'email':
    case 'password':
    case 'uuid':
    case 'mediaUploader':
      return 'z.string()';
    case 'integer':
    case 'number':
      return 'z.coerce.number().int()';
    case 'float':
      return 'z.coerce.number()';
    case 'boolean':
      return 'z.coerce.boolean()';
    case 'array':
      return 'z.array(z.string())';
    case 'date':
    case 'time':
      return 'z.string()';
    case 'timestamp':
    case 'timestamp With Time Zone':
      return DATETIME_TYPE;
    case 'jsonb':
      return 'z.unknown()';
    default:
      return 'z.any()';
  }
}

let usesEmptyToNull = false;
let usesCreateHashPreservingNullish = false;

function isTimestampField(fieldType) {
  return fieldType === 'timestamp' || fieldType === 'timestamp With Time Zone';
}

function isStringField(fieldType) {
  return ['string', 'email', 'password', 'mediaUploader', 'date', 'time', 'uuid'].includes(fieldType);
}

function shouldTrimField(fieldType) {
  return ['string', 'email', 'password', 'uuid', 'date', 'time', 'mediaUploader'].includes(fieldType);
}

function isEmailField(fieldType) {
  return fieldType === 'email';
}

function isPasswordField(fieldType) {
  return fieldType === 'password';
}

function fieldLine({ name, label, type, required, fieldType }) {
  if (fieldType === 'array') {
    return `  ${name}: ${type}.default([]),`;
  }

  const resolvedLabel = label || name;
  const msgLabel = name.endsWith('Id') ? `${resolvedLabel}ID` : resolvedLabel;

  const segments = [`  ${name}: ${type}`];

  if (shouldTrimField(fieldType)) {
    segments.push('.trim()');
  }

  if (required && type.startsWith('z.string()') && isStringField(fieldType)) {
    segments.push(`.min(1, { message: "${msgLabel}は必須です。" })`);
  }

  // jsonb の required チェック（z.unknown() は undefined を許容するため refine で制御）
  if (required && fieldType === 'jsonb') {
    segments.push(`.refine((v) => v != null, { message: "${msgLabel}は必須です。" })`);
  }

  if (isEmailField(fieldType)) {
    segments.push('.email()');
  }

  if (!required && isEmailField(fieldType)) {
    segments.push(`.or(z.literal(''))`);
  }

  if (!required) {
    if (isTimestampField(fieldType)) {
      segments.push(`.or(z.literal("").transform(() => undefined))`);
    }
    segments.push('.nullish()');
    if (isStringField(fieldType)) {
      usesEmptyToNull = true;
      segments.push(`\n    .transform((value) => emptyToNull(value))`);
    }
  }

  if (isPasswordField(fieldType)) {
    usesCreateHashPreservingNullish = true;
    segments.push(
      `\n    .transform(async (value) => await createHashPreservingNullish(value))`,
    );
  }

  segments.push(',');
  return segments.join('');
}

const lines = [];

// belongsTo relations
(config.relations || []).forEach((rel) => {
  if (rel.relationType !== 'belongsTo') return;
  const type = mapZodType(rel.fieldType || config.idType);
  lines.push(
    fieldLine({
      name: rel.fieldName,
      label: rel.label || rel.fieldName,
      type,
      required: rel.required,
      fieldType: rel.fieldType || config.idType,
    }),
  );
});

// belongsToMany relations -> arrays of ids
(config.relations || []).forEach((rel) => {
  if (rel.relationType !== 'belongsToMany' || rel.includeRelationTable === false) return;
  const elem = mapZodType(rel.fieldType || config.idType);
  lines.push(`  ${rel.fieldName}: z.array(${elem}).default([]),`);
});

// normal fields
(config.fields || []).forEach((f) => {
  // formInput: "none" のフィールドはZodスキーマから除外
  if (f.formInput === 'none') return;

  if (f.fieldType === 'enum') {
    const values = (f.options || []).map((o) => `"${o.value}"`).join(', ');
    lines.push(`  ${f.name}: z.enum([${values}])${f.required ? '' : '.nullish()'},`);
  } else {
    const t = mapZodType(f.fieldType);
    lines.push(
      fieldLine({
        name: f.name,
        label: f.label || f.name,
        type: t,
        required: f.required,
        fieldType: f.fieldType,
      }),
    );
  }
});

const header = `// src/features/${camel}/entities/schemaRegistry.ts`;
const importStatements = [];

const stringUtils = [];
if (usesEmptyToNull) {
  stringUtils.push('emptyToNull');
}
if (stringUtils.length) {
  importStatements.push(`import { ${stringUtils.join(', ')} } from "@/utils/string";`);
}

if (usesCreateHashPreservingNullish) {
  importStatements.push(
    'import { createHashPreservingNullish } from "@/utils/hash";',
  );
}

importStatements.push('import { z } from "zod";');

let content = `${header}\n\n${importStatements.join('\n')}\n\n`;
content += `export const ${pascal}BaseSchema = z.object({\n`;
content += lines.join('\n');
// ソフトデリート用の deletedAt フィールド
if (config.useSoftDelete) {
  content += `\n  deletedAt: z.date().nullish(),`;
}
content += `\n});\n\n`;

// CreateSchema と UpdateSchema では deletedAt を除外（サーバー側で管理）
if (config.useSoftDelete) {
  content += `export const ${pascal}CreateSchema = ${pascal}BaseSchema.omit({ deletedAt: true });\n\n`;
  content += `export const ${pascal}UpdateSchema = ${pascal}BaseSchema.partial().omit({ deletedAt: true });\n`;
} else {
  content += `export const ${pascal}CreateSchema = ${pascal}BaseSchema;\n\n`;
  content += `export const ${pascal}UpdateSchema = ${pascal}BaseSchema.partial();\n`;
}

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, content);
console.log(`スキーマを生成しました: ${outputFile}`);
