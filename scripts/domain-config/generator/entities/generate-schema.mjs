#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

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

const camel = domain.charAt(0).toLowerCase() + domain.slice(1);
const pascal = domain.charAt(0).toUpperCase() + domain.slice(1);

const configPath = path.join(process.cwd(), 'src', 'features', camel, 'domain.json');
const outputDir = path.join(process.cwd(), 'src', 'features', camel, 'entities');
const outputFile = path.join(outputDir, 'schema.ts');

if (!fs.existsSync(configPath)) {
  console.error(`設定ファイルが見つかりません: ${configPath}`);
  process.exit(1);
}


const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function mapZodType(type) {
  switch (type) {
    case 'string':
    case 'uuid':
      return 'z.string()';
    case 'integer':
    case 'number':
      return 'z.coerce.number().int()';
    case 'boolean':
      return 'z.coerce.boolean()';
    case 'array':
      return 'z.array(z.string())';
    case 'date':
    case 'time':
      return 'z.string()';
    default:
      return 'z.any()';
  }
}

let usesEmptyToNull = false;

function isStringField(fieldType) {
  return fieldType === 'string';
}

function fieldLine({ name, label, type, required, fieldType }) {
  if (fieldType === 'array') {
    return `  ${name}: ${type}.default([]),`;
  }

  let line = `  ${name}: ${type}`;
  if (required) {
    if (type.startsWith('z.string()')) {
      const resolvedLabel = label || name;
      const msgLabel = name.endsWith('Id') ? `${resolvedLabel}ID` : resolvedLabel;
      line += `.min(1, { message: "${msgLabel}は必須です。" })`;
    }
  } else {
    line += '.nullish()';
    if (isStringField(fieldType)) {
      usesEmptyToNull = true;
      line += `\n    .transform((value) => emptyToNull(value))`;
    }
  }
  line += ',';
  return line;
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
  if (rel.relationType !== 'belongsToMany') return;
  const elem = mapZodType(rel.fieldType || config.idType);
  lines.push(`  ${rel.fieldName}: z.array(${elem}).default([]),`);
});

// normal fields
(config.fields || []).forEach((f) => {
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

if (usesEmptyToNull) {
  importStatements.push('import { emptyToNull } from "@/utils/string";');
}

importStatements.push('import { z } from "zod";');

let content = `${header}\n\n${importStatements.join('\n')}\n\n`;
content += `export const ${pascal}BaseSchema = z.object({\n`;
content += lines.join('\n');
content += `\n});\n\n`;
content += `export const ${pascal}CreateSchema = ${pascal}BaseSchema;\n\n`;
content += `export const ${pascal}UpdateSchema = ${pascal}BaseSchema.partial();\n`;

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, content);
console.log(`スキーマを生成しました: ${outputFile}`);
