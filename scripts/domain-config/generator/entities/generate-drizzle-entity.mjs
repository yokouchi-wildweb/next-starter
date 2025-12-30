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

const normalized = toSnakeCase(domain) || domain;
const camel = toCamelCase(normalized) || normalized;
const pascal = toPascalCase(normalized) || normalized;

const configPath = path.join(process.cwd(), 'src', 'features', camel, 'domain.json');
const outputDir = path.join(process.cwd(), 'src', 'features', camel, 'entities');
const outputFile = path.join(outputDir, 'drizzle.ts');

if (!fs.existsSync(configPath)) {
  console.error(`設定ファイルが見つかりません: ${configPath}`);
  process.exit(1);
}


const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const tableName = toSnakeCase(config.plural || normalized);

function mapType(t) {
  switch (t) {
    case 'string':
    case 'email':
    case 'password':
    case 'mediaUploader':
      return 'text';
    case 'integer':
      return 'integer';
    case 'float':
      return 'doublePrecision';
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

function buildColumn(typeFn, columnName) {
  if (typeFn === 'bigint') {
    return `bigint("${columnName}", { mode: "number" })`;
  }
  return `${typeFn}("${columnName}")`;
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

/**
 * onDelete挙動を取得（後方互換性対応）
 * @param {Object} relation - リレーション設定
 * @returns {string} - CASCADE | RESTRICT | SET_NULL
 */
function getOnDeleteBehavior(relation) {
  // 新形式が存在すれば優先
  if (relation.onDelete) {
    return relation.onDelete;
  }
  // 旧形式からの変換
  if (relation.onDeleteCascade === true) {
    return 'CASCADE';
  }
  // デフォルト: RESTRICT
  return 'RESTRICT';
}

/**
 * onDelete設定からDrizzleオプション文字列を生成
 * @param {string} behavior - CASCADE | RESTRICT | SET_NULL
 * @returns {string} - Drizzleの.references()第2引数
 */
function buildOnDeleteOption(behavior) {
  switch (behavior) {
    case 'CASCADE':
      return ', { onDelete: "cascade" }';
    case 'SET_NULL':
      return ', { onDelete: "set null" }';
    case 'RESTRICT':
      return ', { onDelete: "restrict" }';
    default:
      return '';
  }
}

const imports = new Set(['pgTable']);
const relationImports = new Map();
let usesPrimaryKey = false;
const enumDefs = [];
const fields = [];
// ユニーク制約を持つフィールドを追跡（ソフトデリート時は部分インデックスに変換）
const uniqueFields = [];

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

  // onDelete挙動を取得
  const onDeleteBehavior = getOnDeleteBehavior(rel);

  // バリデーション: SET_NULL + required: true は矛盾
  if (onDeleteBehavior === 'SET_NULL' && rel.required) {
    console.error(`エラー: ${rel.fieldName} で SET_NULL と required: true は同時に設定できません`);
    console.error('  SET_NULL は外部キーを NULL に設定するため、required: false が必要です');
    process.exit(1);
  }

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
    column = buildColumn(colType, columnName);
  }
  let line = `  ${rel.fieldName}: ${column}`;
  if (rel.required) line += '.notNull()';
  const opt = buildOnDeleteOption(onDeleteBehavior);
  line += `\n    .references(() => ${relationDomainPascal}Table.id${opt})`;
  line += ',';
  fields.push(line);
});

// normal fields
(config.fields || []).forEach((f) => {
  const hasDefaultValue = f.defaultValue !== undefined;
  const defaultSuffix = hasDefaultValue ? `.default(${formatValue(f.defaultValue)})` : '';

  if (f.fieldType === 'enum') {
    imports.add('pgEnum');
    const names = enumNames(f.name);
    const values = f.options ? f.options.map(o => formatValue(o.value)).join(', ') : '';
    enumDefs.push(`export const ${names.constName} = pgEnum("${names.enumName}", [${values}]);`);
    const notNull = f.required ? '.notNull()' : '';
    fields.push(`  ${f.name}: ${names.constName}("${toSnakeCase(f.name)}")${notNull}${defaultSuffix},`);
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
    const columnName = toSnakeCase(f.name);
    const column = buildColumn(typeFn, columnName);
    const notNull = f.required ? '.notNull()' : '';
    // ユニーク制約の処理
    let uniqueSuffix = '';
    if (f.unique) {
      if (config.useSoftDelete) {
        // ソフトデリート時は部分インデックスを使用するため、ここでは.unique()を付けない
        uniqueFields.push({ name: f.name, columnName });
      } else {
        uniqueSuffix = '.unique()';
      }
    }
    fields.push(`  ${f.name}: ${column}${notNull}${uniqueSuffix}${defaultSuffix},`);
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
if (config.useSoftDelete) {
  imports.add('timestamp');
  fields.push('  deletedAt: timestamp("deleted_at", { withTimezone: true }),');
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
  const relationRoot = `${pascal}To${relationDomainPascal}`;
  const tableVar = `${relationRoot}Table`;
  const tableName = toSnakeCase(relationRoot);
  relationTables.push({
    tableVar,
    tableName,
    typeFn,
    domainCamel: relationDomainCamel,
    domainPascal: relationDomainPascal,
  });
});

if (usesPrimaryKey) imports.add('primaryKey');
// ソフトデリート + ユニーク制約がある場合は部分インデックス用のimportを追加
const needsPartialIndex = config.useSoftDelete && uniqueFields.length > 0;
// 複合ユニーク制約の有無
const hasCompositeUniques = (config.compositeUniques || []).length > 0;
// uniqueIndexが必要な条件
const needsUniqueIndex = needsPartialIndex || hasCompositeUniques;
if (needsUniqueIndex) {
  imports.add('uniqueIndex');
}

const importLine = `import { ${Array.from(imports).sort().join(', ')} } from "drizzle-orm/pg-core";`;
let content = `// src/features/${camel}/entities/drizzle.ts\n\n`;
content += `${importLine}\n`;
// ソフトデリート + ユニーク制約がある場合は sql を drizzle-orm からインポート
const needsSqlImport = needsPartialIndex || (config.useSoftDelete && hasCompositeUniques);
if (needsSqlImport) {
  content += `import { sql } from "drizzle-orm";\n`;
}
relationImports.forEach((domainPascal, domainCamel) => {
  content += `import { ${domainPascal}Table } from "@/features/${domainCamel}/entities/drizzle";\n`;
});
content += `\n`;
if (enumDefs.length) content += enumDefs.join('\n') + '\n\n';

// インデックス定義を収集（pgTableの第3引数として使用）
const tableIndexes = [];

// ソフトデリート + 単一フィールドユニーク制約のインデックス
if (needsPartialIndex) {
  uniqueFields.forEach((uf) => {
    const indexName = `${tableName}_${uf.columnName}_unique_active`;
    tableIndexes.push(
      `  // ${uf.name} のユニーク制約（アクティブなレコードのみ）\n` +
      `  uniqueIndex("${indexName}").on(table.${uf.name}).where(sql\`deleted_at IS NULL\`)`
    );
  });
}

// 複合ユニーク制約のインデックス
if (hasCompositeUniques) {
  (config.compositeUniques || []).forEach((compositeFields, index) => {
    const indexName = `${tableName}_composite_unique_${index}`;
    const fieldsOnClause = compositeFields.map((f) => `table.${f}`).join(', ');
    let indexDef = `  // 複合ユニーク制約 ${index}: [${compositeFields.join(', ')}]\n`;
    indexDef += `  uniqueIndex("${indexName}").on(${fieldsOnClause})`;
    if (config.useSoftDelete) {
      indexDef += `.where(sql\`deleted_at IS NULL\`)`;
    }
    tableIndexes.push(indexDef);
  });
}

// pgTableの生成（インデックスがある場合は第3引数を追加）
content += `export const ${pascal}Table = pgTable("${tableName}", {\n`;
content += fields.join('\n');
if (tableIndexes.length > 0) {
  content += `\n}, (table) => [\n`;
  content += tableIndexes.join(',\n');
  content += `\n]);\n`;
} else {
  content += `\n});\n`;
}

relationTables.forEach((t) => {
  const baseColumnName = `${toSnakeCase(camel)}_id`;
  const relationColumnName = `${toSnakeCase(t.domainCamel)}_id`;
  const baseColumn = buildColumn(t.typeFn, baseColumnName);
  const relationColumn = buildColumn(t.typeFn, relationColumnName);
  content += `\nexport const ${t.tableVar} = pgTable(\n  "${t.tableName}",\n  {\n    ${camel}Id: ${baseColumn}\n      .notNull()\n      .references(() => ${pascal}Table.id, { onDelete: "cascade" }),\n    ${t.domainCamel}Id: ${relationColumn}\n      .notNull()\n      .references(() => ${t.domainPascal}Table.id, { onDelete: "cascade" }),\n  },\n  (table) => {\n    return { pk: primaryKey({ columns: [table.${camel}Id, table.${t.domainCamel}Id] }) };\n  },\n);\n`;
});

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, content);
console.log(`Drizzle エンティティを生成しました: ${outputFile}`);
