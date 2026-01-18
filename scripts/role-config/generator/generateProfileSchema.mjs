// scripts/role-config/generator/generateProfileSchema.mjs
// generated/{roleId}/schema.ts の生成（Zodスキーマ）

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/generated"
);

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
    case "numeric(10,2)":
      return "z.coerce.number()";
    case "bigint":
      return "z.coerce.number().int()";
    case "boolean":
      return "z.coerce.boolean()";
    case "array":
      return "z.array(z.string())";
    case "date":
    case "time":
      return "z.string()";
    case "timestamp":
    case "timestamp With Time Zone":
      return DATETIME_TYPE;
    default:
      return "z.any()";
  }
}

function isTimestampField(fieldType) {
  return fieldType === "timestamp" || fieldType === "timestamp With Time Zone";
}

function isStringField(fieldType) {
  return ["string", "email", "password", "mediaUploader", "date", "time", "uuid"].includes(fieldType);
}

function shouldTrimField(fieldType) {
  return ["string", "email", "password", "uuid", "date", "time", "mediaUploader"].includes(fieldType);
}

function isEmailField(fieldType) {
  return fieldType === "email";
}

let usesEmptyToNull = false;

function fieldLine({ name, label, type, required, fieldType }) {
  if (fieldType === "array") {
    return `  ${name}: ${type}.default([]),`;
  }

  const resolvedLabel = label || name;
  const segments = [`  ${name}: ${type}`];

  if (shouldTrimField(fieldType)) {
    segments.push(".trim()");
  }

  if (required && type.startsWith("z.string()") && isStringField(fieldType)) {
    segments.push(`.min(1, { message: "${resolvedLabel}は必須です。" })`);
  }

  if (isEmailField(fieldType)) {
    segments.push(".email()");
  }

  if (!required && isEmailField(fieldType)) {
    segments.push(`.or(z.literal(""))`);
  }

  if (!required) {
    if (isTimestampField(fieldType)) {
      segments.push(`.or(z.literal("").transform(() => undefined))`);
    }
    segments.push(".nullish()");
    if (isStringField(fieldType)) {
      usesEmptyToNull = true;
      segments.push(`\n    .transform((value) => emptyToNull(value))`);
    }
  }

  segments.push(",");
  return segments.join("");
}

/**
 * generated/{roleId}/schema.ts を生成
 */
export function generateProfileSchema(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);

  usesEmptyToNull = false;
  const lines = [];

  // フィールド定義
  (profileConfig.fields || []).forEach((f) => {
    if (f.formInput === "none" || f.formInput === "hidden") return;

    if (f.fieldType === "enum") {
      const values = (f.options || []).map((o) => `"${o.value}"`).join(", ");
      lines.push(`  ${toCamelCase(f.name)}: z.enum([${values}])${f.required ? "" : ".nullish()"},`);
    } else {
      const t = mapZodType(f.fieldType);
      lines.push(
        fieldLine({
          name: toCamelCase(f.name),
          label: f.label || f.name,
          type: t,
          required: f.required,
          fieldType: f.fieldType,
        })
      );
    }
  });

  const importStatements = [];
  if (usesEmptyToNull) {
    importStatements.push(`import { emptyToNull } from "@/utils/string";`);
  }
  importStatements.push(`import { z } from "zod";`);

  const content = `// src/features/core/userProfile/generated/${roleId}/schema.ts
// ${roleConfig.label}プロフィールのZodスキーマ
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

${importStatements.join("\n")}

/**
 * ${roleConfig.label}プロフィールスキーマ
 */
export const ${rolePascal}ProfileSchema = z.object({
${lines.join("\n")}
});

export type ${rolePascal}ProfileData = z.infer<typeof ${rolePascal}ProfileSchema>;
`;

  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "schema.ts");
  fs.writeFileSync(filePath, content);
}
