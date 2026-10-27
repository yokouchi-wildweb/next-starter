// entities/schema.ts（Zod スキーマ: Base / Create / Update）。formInput: "none" の項目は含めない（"custom" は含める）

import { resolveFieldName } from "../../domain/fieldName.mjs";

const DATETIME_TYPE = "nullableDatetime";
const REQUIRED_DATETIME_TYPE = "requiredDatetime";
const STRING_FIELD_TYPES = ["string", "email", "password", "mediaUploader", "date", "time", "uuid"];
const TRIM_FIELD_TYPES = ["string", "email", "password", "uuid", "date", "time", "mediaUploader"];

function mapZodType(type, required = false) {
  switch (type) {
    case "string":
    case "email":
    case "password":
    case "uuid":
    case "mediaUploader":
      return "z.string()";
    case "integer":
    case "number":
      return "z.coerce.number().int()";
    case "float":
      return "z.coerce.number()";
    case "boolean":
      return "z.coerce.boolean()";
    case "array":
    case "stringArray":
      return "z.array(z.string())";
    case "date":
    case "time":
      return "z.string()";
    case "timestamp":
    case "timestamp With Time Zone":
      return required ? REQUIRED_DATETIME_TYPE : DATETIME_TYPE;
    case "jsonb":
      return "z.unknown()";
    default:
      return "z.any()";
  }
}

const isTimestampField = (fieldType) => fieldType === "timestamp" || fieldType === "timestamp With Time Zone";
const formatSchemaDefault = (value) => (typeof value === "string" ? `"${value}"` : value);

/** 使った補助関数を記録しながら 1 項目の行を作る */
function fieldLine(uses, { name, label, type, required, fieldType, defaultValue, validationRule }) {
  const resolvedLabel = label || name;
  // メディア列: 値は storage ref または http(s)（凍結した旧 URL）。新しい行に旧 URL を書けるかは CRUD 連動（storage binding）が判定する
  if (fieldType === "mediaUploader") {
    uses.storageMediaValue = true;
    if (required) {
      return `  ${name}: z.string().trim().min(1, { message: "${resolvedLabel}は必須です。" }).pipe(storageMediaValueSchema),`;
    }
    uses.emptyToNull = true;
    return `  ${name}: z.string().trim().nullish()\n    .transform((value) => emptyToNull(value))\n    .pipe(storageMediaValueSchema.nullish()),`;
  }
  if (fieldType === "mediaUploaderMulti") {
    uses.storageMediaValue = true;
    // 複数枚アップローダ: 常に default([])。required は min(1) として表現
    const minItems = typeof validationRule?.minItems === "number" ? validationRule.minItems : required ? 1 : 0;
    const maxItems = typeof validationRule?.maxItems === "number" ? validationRule.maxItems : 10;
    const segments = [`  ${name}: z.array(storageMediaValueSchema)`];
    if (minItems > 0) {
      segments.push(`.min(${minItems}, { message: "${resolvedLabel}は${minItems}件以上必要です。" })`);
    }
    segments.push(`.max(${maxItems}, { message: "${resolvedLabel}は${maxItems}件以下にしてください。" })`, ".default([])", ",");
    return segments.join("");
  }
  if (fieldType === "array" || fieldType === "stringArray") {
    return required ? `  ${name}: ${type}.default([]),` : `  ${name}: ${type}.nullish(),`;
  }
  if (isTimestampField(fieldType)) {
    if (required) uses.requiredDatetime = true;
    else uses.nullableDatetime = true;
  }

  const msgLabel = name.endsWith("Id") ? `${resolvedLabel}ID` : resolvedLabel;
  const isString = STRING_FIELD_TYPES.includes(fieldType);
  const segments = [`  ${name}: ${type}`];
  if (TRIM_FIELD_TYPES.includes(fieldType)) segments.push(".trim()");
  if (required && type.startsWith("z.string()") && isString) {
    segments.push(`.min(1, { message: "${msgLabel}は必須です。" })`);
  }
  // jsonb の required チェック（z.unknown() は undefined を許容するため refine で制御）
  if (required && fieldType === "jsonb") {
    segments.push(`.refine((v) => v != null, { message: "${msgLabel}は必須です。" })`);
  }
  if (fieldType === "email") segments.push(".email()");
  if (!required && fieldType === "email") segments.push(`.or(z.literal(''))`);
  if (!required) {
    segments.push(".nullish()");
    if (isString) {
      uses.emptyToNull = true;
      segments.push(`\n    .transform((value) => emptyToNull(value))`);
    }
  }
  if (fieldType === "password") {
    uses.createHashPreservingNullish = true;
    segments.push(`\n    .transform(async (value) => await createHashPreservingNullish(value))`);
  }
  if (defaultValue !== undefined) segments.push(`.default(${formatSchemaDefault(defaultValue)})`);
  segments.push(",");
  return segments.join("");
}

function buildImports(uses) {
  const importStatements = [];
  if (uses.emptyToNull) importStatements.push(`import { emptyToNull } from "@/utils/string";`);
  if (uses.createHashPreservingNullish) importStatements.push('import { createHashPreservingNullish } from "@/utils/hash";');
  if (uses.nullableDatetime || uses.requiredDatetime) {
    const datetimeImports = [];
    if (uses.nullableDatetime) datetimeImports.push("nullableDatetime");
    if (uses.requiredDatetime) datetimeImports.push("requiredDatetime");
    importStatements.push(`import { ${datetimeImports.join(", ")} } from "@/lib/crud/utils";`);
  }
  if (uses.storageMediaValue) importStatements.push('import { storageMediaValueSchema } from "@/lib/storage/schema";');
  importStatements.push('import { z } from "zod";');
  return importStatements;
}

/** @returns {string} entities/schema.ts の内容 */
export function renderSchema(ctx) {
  const { config, camel, pascal, dbEngine } = ctx;
  const uses = {};
  const lines = [];

  (config.relations || []).forEach((rel) => {
    if (rel.relationType !== "belongsTo") return;
    const fieldType = rel.fieldType || config.idType;
    lines.push(
      fieldLine(uses, {
        name: resolveFieldName(rel.fieldName, dbEngine),
        label: rel.label || rel.fieldName,
        type: mapZodType(fieldType),
        required: rel.required,
        fieldType,
      }),
    );
  });
  // belongsToMany は id の配列
  (config.relations || []).forEach((rel) => {
    if (rel.relationType !== "belongsToMany" || rel.includeRelationTable === false) return;
    lines.push(`  ${resolveFieldName(rel.fieldName, dbEngine)}: z.array(${mapZodType(rel.fieldType || config.idType)}).default([]),`);
  });
  (config.fields || []).forEach((f) => {
    if (f.formInput === "none") return;
    const fieldName = resolveFieldName(f.name, dbEngine);
    if (f.fieldType === "enum") {
      const values = (f.options || []).map((o) => `"${o.value}"`).join(", ");
      const defaultSuffix = f.defaultValue !== undefined ? `.default(${formatSchemaDefault(f.defaultValue)})` : "";
      lines.push(`  ${fieldName}: z.enum([${values}])${f.required ? "" : ".nullish()"}${defaultSuffix},`);
    } else {
      lines.push(
        fieldLine(uses, {
          name: fieldName,
          label: f.label || f.name,
          type: mapZodType(f.fieldType, f.required),
          required: f.required,
          fieldType: f.fieldType,
          defaultValue: f.defaultValue,
          validationRule: f.validationRule,
        }),
      );
    }
  });

  let content = `// src/features/${camel}/entities/schemaRegistry.ts\n\n${buildImports(uses).join("\n")}\n\n`;
  content += `export const ${pascal}BaseSchema = z.object({\n${lines.join("\n")}`;
  // ソフトデリート用の deletedAt（Create / Update からは除外 = サーバー側で管理）
  if (config.useSoftDelete) content += `\n  deletedAt: z.date().nullish(),`;
  content += `\n});\n\n`;
  if (config.useSoftDelete) {
    content += `export const ${pascal}CreateSchema = ${pascal}BaseSchema.omit({ deletedAt: true });\n\n`;
    content += `export const ${pascal}UpdateSchema = ${pascal}BaseSchema.partial().omit({ deletedAt: true });\n`;
  } else {
    content += `export const ${pascal}CreateSchema = ${pascal}BaseSchema;\n\n`;
    content += `export const ${pascal}UpdateSchema = ${pascal}BaseSchema.partial();\n`;
  }
  return content;
}
