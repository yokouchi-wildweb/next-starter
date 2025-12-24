#!/usr/bin/env node
/**
 * settingDefaults.extended.ts を生成するジェネレーター
 */
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { readSettingFields } from "../utils/config-reader.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * settingDefaults.extended.ts の出力パスを取得
 */
function getOutputPath() {
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  return path.join(rootDir, "src", "features", "core", "setting", "services", "server", "settingDefaults.extended.ts");
}

/**
 * フィールドからデフォルト値を取得
 */
function getDefaultValue(field) {
  const { fieldType, defaultValue } = field;

  // 明示的なデフォルト値がある場合
  if (defaultValue !== undefined) {
    if (typeof defaultValue === "string") {
      return `"${defaultValue}"`;
    }
    if (typeof defaultValue === "boolean") {
      return defaultValue.toString();
    }
    if (typeof defaultValue === "number") {
      return defaultValue.toString();
    }
    return JSON.stringify(defaultValue);
  }

  // フィールドタイプに応じたデフォルト値
  switch (fieldType) {
    case "string":
    case "mediaUploader":
      return "null";
    case "integer":
    case "float":
      return "0";
    case "boolean":
      return "false";
    case "enum":
      return "null";
    case "date":
    case "time":
    case "timestamp":
    case "timestamp With Time Zone":
      return "null";
    default:
      return "null";
  }
}

/**
 * フィールド定義からデフォルト値の行を生成
 */
function generateDefaultLine(field) {
  const { name } = field;
  const defaultValue = getDefaultValue(field);
  return `  ${name}: ${defaultValue},`;
}

/**
 * settingDefaults.extended.ts を生成
 */
export default function generateDefaultsExtended() {
  const config = readSettingFields();
  const fields = config?.fields ?? [];
  const defaultLines = fields.length > 0
    ? fields.map(generateDefaultLine).join("\n")
    : "  // 拡張フィールドなし";

  const content = `// src/features/core/setting/services/server/settingDefaults.extended.ts
// [GENERATED] このファイルは自動生成されます。直接編集しないでください。
// 生成元: setting-fields.json
// 生成コマンド: pnpm sc:generate

/**
 * 拡張設定項目のデフォルト値
 * settingService.ts の createDefaultSettingValues() で使用
 */
export const extendedDefaultSettingValues = {
${defaultLines}
};
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
  generateDefaultsExtended();
}
