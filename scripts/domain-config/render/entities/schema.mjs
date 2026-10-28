// entities/schema.ts（Zod スキーマ: Base / Create / Update）。formInput: "none" の項目は含めない（"custom" は含める）。
// 型 → Zod の対応は spec/fieldTypes.mjs の表。メディア列・配列・enum だけここで形を変える

import { resolveFieldName } from "../../domain/fieldName.mjs";
import { belongsToManyRelations, belongsToRelations } from "../../domain/relations.mjs";
import { isArrayFieldType, isCollectionFieldType, isTextFieldType, isTimestampFieldType, zodType } from "../../spec/fieldTypes.mjs";

const formatSchemaDefault = (value) => (typeof value === "string" ? `"${value}"` : value);

/** メディア列: 値は storage ref または http(s)（凍結した旧 URL）。新しい行に旧 URL を書けるかは CRUD 連動（storage binding）が判定する */
function mediaLine(uses, { name, label, required, fieldType, validationRule }) {
  uses.storageMediaValue = true;
  if (fieldType === "mediaUploader") {
    if (required) {
      return `  ${name}: z.string().trim().min(1, { message: "${label}は必須です。" }).pipe(storageMediaValueSchema),`;
    }
    uses.emptyToNull = true;
    return `  ${name}: z.string().trim().nullish()\n    .transform((value) => emptyToNull(value))\n    .pipe(storageMediaValueSchema.nullish()),`;
  }
  // 複数枚アップローダ: 常に default([])。required は min(1) として表現
  const minItems = typeof validationRule?.minItems === "number" ? validationRule.minItems : required ? 1 : 0;
  const maxItems = typeof validationRule?.maxItems === "number" ? validationRule.maxItems : 10;
  const segments = [`  ${name}: z.array(storageMediaValueSchema)`];
  if (minItems > 0) {
    segments.push(`.min(${minItems}, { message: "${label}は${minItems}件以上必要です。" })`);
  }
  segments.push(`.max(${maxItems}, { message: "${label}は${maxItems}件以下にしてください。" })`, ".default([])", ",");
  return segments.join("");
}

/**
 * 主の集まりの項目: 値は従属の file の値（storage ref）の並び。複数枚の行と同じ値のスキーマで、
 * required → 1 件以上（lib の minItems と同じ）、collection.maxItems → 上限（省略 = 上限なし）。default([]) も複数枚の行と同じ
 */
function collectionLine(uses, { name, label, required, collection }) {
  uses.storageMediaValue = true;
  const segments = [`  ${name}: z.array(storageMediaValueSchema)`];
  if (required) segments.push(`.min(1, { message: "${label}は1件以上必要です。" })`);
  if (typeof collection?.maxItems === "number") {
    segments.push(`.max(${collection.maxItems}, { message: "${label}は${collection.maxItems}件以下にしてください。" })`);
  }
  segments.push(".default([])", ",");
  return segments.join("");
}

/** 使った補助関数を記録しながら 1 項目の行を作る */
function fieldLine(uses, { name, label, type, required, fieldType, defaultValue, validationRule }) {
  const resolvedLabel = label || name;
  if (fieldType === "mediaUploader" || fieldType === "mediaUploaderMulti") {
    return mediaLine(uses, { name, label: resolvedLabel, required, fieldType, validationRule });
  }
  if (isArrayFieldType(fieldType)) {
    return required ? `  ${name}: ${type}.default([]),` : `  ${name}: ${type}.nullish(),`;
  }
  if (isTimestampFieldType(fieldType)) {
    if (required) uses.requiredDatetime = true;
    else uses.nullableDatetime = true;
  }

  const msgLabel = name.endsWith("Id") ? `${resolvedLabel}ID` : resolvedLabel;
  const isText = isTextFieldType(fieldType);
  const segments = [`  ${name}: ${type}`];
  if (isText) segments.push(".trim()");
  if (required && type.startsWith("z.string()") && isText) {
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
    if (isText) {
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

  belongsToRelations(config).forEach((rel) => {
    const fieldType = rel.fieldType || config.idType;
    lines.push(
      fieldLine(uses, {
        name: resolveFieldName(rel.fieldName, dbEngine),
        label: rel.label || rel.fieldName,
        type: zodType(fieldType),
        required: rel.required,
        fieldType,
      }),
    );
  });
  // belongsToMany は id の配列
  belongsToManyRelations(config).forEach((rel) => {
    lines.push(`  ${resolveFieldName(rel.fieldName, dbEngine)}: z.array(${zodType(rel.fieldType || config.idType)}).default([]),`);
  });
  (config.fields || []).forEach((f) => {
    if (f.formInput === "none") return;
    const fieldName = resolveFieldName(f.name, dbEngine);
    if (isCollectionFieldType(f.fieldType)) {
      lines.push(collectionLine(uses, { name: fieldName, label: f.label || f.name, required: f.required, collection: f.collection }));
    } else if (f.fieldType === "enum") {
      const values = (f.options || []).map((o) => `"${o.value}"`).join(", ");
      const defaultSuffix = f.defaultValue !== undefined ? `.default(${formatSchemaDefault(f.defaultValue)})` : "";
      lines.push(`  ${fieldName}: z.enum([${values}])${f.required ? "" : ".nullish()"}${defaultSuffix},`);
    } else {
      lines.push(
        fieldLine(uses, {
          name: fieldName,
          label: f.label || f.name,
          type: zodType(f.fieldType, f.required),
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
