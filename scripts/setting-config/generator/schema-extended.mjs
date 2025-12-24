#!/usr/bin/env node
/**
 * schema.extended.ts を生成するジェネレーター
 */
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { readSettingFields } from "../utils/config-reader.mjs";
import { mapZodType } from "../utils/type-mappers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * schema.extended.ts の出力パスを取得
 */
function getOutputPath() {
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  return path.join(rootDir, "src", "features", "core", "setting", "entities", "schema.extended.ts");
}

/**
 * フィールド定義からZodスキーマの行を生成
 */
function generateFieldLine(field) {
  const { name, label, required } = field;
  const zodType = mapZodType(field);

  // 必須フィールドにはエラーメッセージを追加
  let line = `  ${name}: ${zodType}`;

  // 必須フィールドで文字列型の場合、min(1) にメッセージを追加
  if (required && (field.fieldType === "string" || field.fieldType === "mediaUploader")) {
    line = `  ${name}: z.string().trim().min(1, { message: "${label}は必須です" })`;
  }

  return line;
}

/**
 * schema.extended.ts を生成
 */
export default function generateSchemaExtended() {
  const config = readSettingFields();

  if (!config || !config.fields || config.fields.length === 0) {
    console.log("拡張フィールドがないため、schema.extended.ts の生成をスキップします");
    return false;
  }

  const fields = config.fields;
  const fieldLines = fields.map(generateFieldLine).join(",\n");

  const content = `// src/features/core/setting/entities/schema.extended.ts
// [GENERATED] このファイルは自動生成されます。直接編集しないでください。
// 生成元: setting-fields.json
// 生成コマンド: pnpm sc:generate

import { z } from "zod";

/**
 * 拡張設定項目のベーススキーマ
 */
export const SettingExtendedBaseSchema = z.object({
${fieldLines},
});

/**
 * 拡張設定項目の更新スキーマ
 */
export const SettingExtendedUpdateSchema = SettingExtendedBaseSchema.partial();

/**
 * 拡張設定項目の作成スキーマ
 */
export const SettingExtendedCreateSchema = SettingExtendedBaseSchema;
`;

  const outputPath = getOutputPath();
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, "utf-8");
  console.log(`生成完了: ${outputPath}`);
  return true;
}

// 直接実行時の処理
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateSchemaExtended();
}
