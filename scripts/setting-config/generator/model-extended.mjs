#!/usr/bin/env node
/**
 * model.extended.ts を生成するジェネレーター
 */
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { readSettingFields } from "../utils/config-reader.mjs";
import { mapTsType } from "../utils/type-mappers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * model.extended.ts の出力パスを取得
 */
function getOutputPath() {
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  return path.join(rootDir, "src", "features", "core", "setting", "entities", "model.extended.ts");
}

/**
 * フィールド定義からTypeScript型の行を生成
 */
function generateFieldLine(field) {
  const { name } = field;
  const tsType = mapTsType(field);
  return `  ${name}: ${tsType};`;
}

/**
 * model.extended.ts を生成
 */
export default function generateModelExtended() {
  const config = readSettingFields();

  if (!config || !config.fields || config.fields.length === 0) {
    console.log("拡張フィールドがないため、model.extended.ts の生成をスキップします");
    return false;
  }

  const fields = config.fields;
  const fieldLines = fields.map(generateFieldLine).join("\n");

  const content = `// src/features/core/setting/entities/model.extended.ts
// [GENERATED] このファイルは自動生成されます。直接編集しないでください。
// 生成元: setting-fields.json
// 生成コマンド: pnpm sc:generate

/**
 * 拡張設定項目の型定義
 */
export type SettingExtended = {
${fieldLines}
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
  generateModelExtended();
}
