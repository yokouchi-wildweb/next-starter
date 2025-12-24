#!/usr/bin/env node
/**
 * form.extended.ts を生成するジェネレーター
 */
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { readSettingFields } from "../utils/config-reader.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * form.extended.ts の出力パスを取得
 */
function getOutputPath() {
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  return path.join(rootDir, "src", "features", "core", "setting", "entities", "form.extended.ts");
}

/**
 * form.extended.ts を生成
 */
export default function generateFormExtended() {
  const content = `// src/features/core/setting/entities/form.extended.ts
// [GENERATED] このファイルは自動生成されます。直接編集しないでください。
// 生成元: setting-fields.json
// 生成コマンド: pnpm sc:generate

import { z } from "zod";
import { SettingExtendedUpdateSchema } from "./schema.extended";

/**
 * 拡張設定フォームの型定義
 */
export type SettingExtendedUpdateFields = z.infer<typeof SettingExtendedUpdateSchema>;
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
  generateFormExtended();
}
