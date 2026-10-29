// scripts/role-config/generator/generateProfileSchema.mjs
// generated/{roleId}/schema.ts の生成（Zodスキーマ）

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../src/utils/stringCase.mjs";
import {
  isArrayFieldType,
  isEmailFieldType,
  isEnumFieldType,
  isTextFieldType,
  isTimestampFieldType,
  zodType,
} from "../../../src/lib/domain/fields/fieldTypes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/generated"
);

// 型 → Zod は型の表（src/lib/domain/fields/fieldTypes.mjs）。プロフィールの日時は必須でも nullableDatetime（ドメインとの違い。今の生成物どおり）
const mapZodType = (fieldType) => zodType(fieldType, false);

let usesEmptyToNull = false;
let usesNullableDatetime = false;

function fieldLine({ name, label, type, required, fieldType }) {
  if (isArrayFieldType(fieldType)) {
    return `  ${name}: ${type}.default([]),`;
  }

  if (isTimestampFieldType(fieldType)) {
    usesNullableDatetime = true;
  }

  const resolvedLabel = label || name;
  const segments = [`  ${name}: ${type}`];

  if (isTextFieldType(fieldType)) {
    segments.push(".trim()");
  }

  if (required && type.startsWith("z.string()") && isTextFieldType(fieldType)) {
    segments.push(`.min(1, { message: "${resolvedLabel}は必須です。" })`);
  }

  if (isEmailFieldType(fieldType)) {
    segments.push(".email()");
  }

  if (!required && isEmailFieldType(fieldType)) {
    segments.push(`.or(z.literal(""))`);
  }

  if (!required) {
    segments.push(".nullish()");
    if (isTextFieldType(fieldType)) {
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
  usesNullableDatetime = false;
  const lines = [];

  // belongsTo リレーションの FK フィールド
  (profileConfig.relations || []).forEach((rel) => {
    if (rel.relationType !== "belongsTo") return;
    const camelName = toCamelCase(rel.fieldName);
    lines.push(
      fieldLine({
        name: camelName,
        label: rel.label,
        type: "z.string()",
        required: rel.required,
        fieldType: "uuid",
      })
    );
  });

  // フィールド定義
  (profileConfig.fields || []).forEach((f) => {
    if (f.formInput === "none" || f.formInput === "hidden") return;

    if (isEnumFieldType(f.fieldType)) {
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
  if (usesNullableDatetime) {
    importStatements.push(`import { nullableDatetime } from "@/lib/crud/utils";`);
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
