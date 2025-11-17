#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { toCamelCase, toPascalCase, toSnakeCase } from '../../../../src/utils/stringCase.mjs';

// Drizzle entity generator
// Usage:
//   node scripts/domain-config/generator/generate-drizzle-entity.mjs <Domain>

const args = process.argv.slice(2);
const domain = args[0];

if (!domain) {
  console.error('使い方: node scripts/domain-config/generator/generate-drizzle-entity.mjs <Domain>');
  process.exit(1);
}

const camel = toCamelCase(domain);
const pascal = toPascalCase(domain);

const configPath = path.join(process.cwd(), 'src', 'features', camel, 'domain.json');
const outputDir = path.join(process.cwd(), 'src', 'features', camel, 'entities');
const outputFile = path.join(outputDir, 'drizzle.ts');

if (!fs.existsSync(configPath)) {
  console.error(`設定ファイルが見つかりません: ${configPath}`);
  process.exit(1);
}


const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const tableName = toSnakeCase(config.plural || camel);

function mapType(t) {
  switch (t) {
    case 'string':
    case 'email':
    case 'password':
      return 'text';
    case 'integer':
      return 'integer';
    case 'bigint':
      return 'bigint';
    case 'numeric(10,2)':
      return 'numeric';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'uuid':
      return 'uuid';
    case 'timestamp With Time Zone':
      return 'timestamp';
    case 'jsonb':
      return 'jsonb';
    default:
      return t;
  }
}

function enumNames(fieldName) {
  const domainPrefix = camel.toLowerCase();
  let base = fieldName;
  if (base.toLowerCase().startsWith(domainPrefix)) {
    base = base.slice(domainPrefix.length);
  }
  base = toPascalCase(base).replace(/Field$/, '');
  const constName = `${pascal}${base}Enum`;
  const enumName = `${camel}_${toSnakeCase(base)}_enum`;
  return { constName, enumName };
}

function formatValue(v) {
  return typeof v === 'string' ? `"${v}"` : v;
}

const imports = new Set(['pgTable']);
const relationImports = new Map();
let usesPrimaryKey = false;
const enumDefs = [];
const fields = [];

// ID field
switch (config.idType) {
  case 'uuid':
    imports.add('uuid');
    fields.push(`  id: uuid("id").defaultRandom().primaryKey(),`);
    break;
  case 'string':
    imports.add('text');
    fields.push(`  id: text("id").primaryKey(),`);
    break;
  case 'number':
    imports.add('integer');
    fields.push(`  id: integer("id").primaryKey(),`);
    break;
  default:
    imports.add('text');
    fields.push(`  id: text("id").primaryKey(),`);
}

// belongsTo relations
(config.relations || []).forEach((rel) => {
  if (rel.relationType !== 'belongsTo') return;
  const relationDomainCamel = toCamelCase(rel.domain);
  const relationDomainPascal = toPascalCase(rel.domain);
  relationImports.set(relationDomainCamel, relationDomainPascal);
  const colType = mapType(rel.fieldType || config.idType);
  imports.add(colType);
  const columnName = toSnakeCase(rel.fieldName);
  let column;
  if (rel.fieldType === 'timestamp With Time Zone') {
    column = `timestamp("${columnName}", { withTimezone: true })`;
  } else {
    column = `${colType}("${columnName}")`;
  }
  let line = `  ${rel.fieldName}: ${column}`;
  if (rel.required) line += '.notNull()';
  const opt = rel.onDeleteCascade ? ', { onDelete: "cascade" }' : '';
  line += `\n    .references(() => ${relationDomainPascal}Table.id${opt})`;
  line += ',';
  fields.push(line);
});

// normal fields
(config.fields || []).forEach((f) => {
  if (f.fieldType === 'enum') {
    imports.add('pgEnum');
    const names = enumNames(f.name);
    const values = f.options ? f.options.map(o => formatValue(o.value)).join(', ') : '';
    enumDefs.push(`export const ${names.constName} = pgEnum("${names.enumName}", [${values}]);`);
    fields.push(`  ${f.name}: ${names.constName}("${toSnakeCase(f.name)}")${f.required ? '.notNull()' : ''},`);
  } else if (f.fieldType === 'array') {
    imports.add('text');
    fields.push(
      `  ${f.name}: text("${toSnakeCase(f.name)}").array().notNull(),`
    );
  } else if (f.fieldType === 'timestamp With Time Zone') {
    imports.add('timestamp');
    let column = `timestamp("${toSnakeCase(f.name)}", { withTimezone: true })`;
    if (f.required) column += '.notNull()';
    fields.push(`  ${f.name}: ${column},`);
  } else {
    const typeFn = mapType(f.fieldType);
    imports.add(typeFn);
    fields.push(`  ${f.name}: ${typeFn}("${toSnakeCase(f.name)}")${f.required ? '.notNull()' : ''},`);
  }
});

if (config.useCreatedAt) {
  imports.add('timestamp');
  fields.push('  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),');
}
if (config.useUpdatedAt) {
  imports.add('timestamp');
  fields.push('  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),');
}

const relationTables = [];
(config.relations || []).forEach((rel) => {
  if (rel.relationType !== 'belongsToMany' || rel.includeRelationTable === false) return;
  usesPrimaryKey = true;
  const typeFn = mapType(rel.fieldType || config.idType);
  imports.add(typeFn);
  const relationDomainCamel = toCamelCase(rel.domain);
  const relationDomainPascal = toPascalCase(rel.domain);
  relationImports.set(relationDomainCamel, relationDomainPascal);
  const tableVar = `${pascal}To${relationDomainPascal}Table`;
  const tableName = `${toSnakeCase(camel)}_to_${toSnakeCase(relationDomainCamel)}`;
  relationTables.push({
    tableVar,
    tableName,
    typeFn,
    domainCamel: relationDomainCamel,
    domainPascal: relationDomainPascal,
  });
});

if (usesPrimaryKey) imports.add('primaryKey');

const importLine = `import { ${Array.from(imports).sort().join(', ')} } from "drizzle-orm/pg-core";`;
let content = `// src/features/${camel}/entities/drizzle.ts\n\n`;
content += `${importLine}\n`;
relationImports.forEach((domainPascal, domainCamel) => {
  content += `import { ${domainPascal}Table } from "@/features/${domainCamel}/entities/drizzle";\n`;
});
content += `\n`;
if (enumDefs.length) content += enumDefs.join('\n') + '\n\n';
content += `export const ${pascal}Table = pgTable("${tableName}", {\n`;
content += fields.join('\n');
content += `\n});\n`;
relationTables.forEach((t) => {
  content += `\nexport const ${t.tableVar} = pgTable(\n  "${t.tableName}",\n  {\n    ${camel}Id: ${t.typeFn}("${toSnakeCase(camel)}_id")\n      .notNull()\n      .references(() => ${pascal}Table.id, { onDelete: "cascade" }),\n    ${t.domainCamel}Id: ${t.typeFn}("${toSnakeCase(t.domainCamel)}_id")\n      .notNull()\n      .references(() => ${t.domainPascal}Table.id, { onDelete: "cascade" }),\n  },\n  (table) => {\n    return { pk: primaryKey({ columns: [table.${camel}Id, table.${t.domainCamel}Id] }) };\n  },\n);\n`;
});

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, content);
console.log(`Drizzle エンティティを生成しました: ${outputFile}`);
