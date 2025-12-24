#!/usr/bin/env node
/**
 * 拡張ファイル生成のオーケストレーター
 */
import { fileURLToPath } from "url";
import { readSettingFields, getSettingFieldsPath } from "./utils/config-reader.mjs";
import generateSchemaExtended from "./generator/schema-extended.mjs";
import generateModelExtended from "./generator/model-extended.mjs";
import generateFormExtended from "./generator/form-extended.mjs";
import updateDrizzle from "./generator/drizzle-updater.mjs";
import generateDefaultsExtended from "./generator/defaults-extended.mjs";
import generateFieldsExtended from "./generator/fields-extended.mjs";

/**
 * 全拡張ファイルを生成
 */
export default async function generate() {
  console.log("\n\x1b[1m=== Setting Config: 拡張ファイル生成 ===\x1b[0m\n");

  // 設定ファイルの確認
  const config = readSettingFields();

  if (!config) {
    console.log(`\x1b[33m設定ファイルが見つかりません: ${getSettingFieldsPath()}\x1b[0m`);
    console.log("pnpm sc:init で初期化してください");
    return false;
  }

  const fieldCount = config.fields?.length ?? 0;
  console.log(`設定ファイル: ${getSettingFieldsPath()}`);
  console.log(`拡張フィールド数: ${fieldCount}件`);

  if (fieldCount === 0) {
    console.log("\n\x1b[33m拡張フィールドが0件です。空の状態で再生成します\x1b[0m");
  }

  console.log("\n--- エンティティファイル生成 ---\n");

  // 1. Zodスキーマ生成
  try {
    generateSchemaExtended();
  } catch (err) {
    console.error(`\x1b[31mschema.extended.ts の生成に失敗: ${err.message}\x1b[0m`);
  }

  // 2. TypeScript型定義生成
  try {
    generateModelExtended();
  } catch (err) {
    console.error(`\x1b[31mmodel.extended.ts の生成に失敗: ${err.message}\x1b[0m`);
  }

  // 3. フォーム型定義生成
  try {
    generateFormExtended();
  } catch (err) {
    console.error(`\x1b[31mform.extended.ts の生成に失敗: ${err.message}\x1b[0m`);
  }

  // 4. Drizzleカラム更新
  try {
    updateDrizzle();
  } catch (err) {
    console.error(`\x1b[31mdrizzle.ts の更新に失敗: ${err.message}\x1b[0m`);
  }

  // 5. デフォルト値生成
  try {
    generateDefaultsExtended();
  } catch (err) {
    console.error(`\x1b[31msettingDefaults.extended.ts の生成に失敗: ${err.message}\x1b[0m`);
  }

  console.log("\n--- UIコンポーネント生成 ---\n");

  // 6. 拡張フィールドコンポーネント生成
  try {
    generateFieldsExtended();
  } catch (err) {
    console.error(`\x1b[31mExtendedSettingFields.tsx の生成に失敗: ${err.message}\x1b[0m`);
  }

  console.log("\n\x1b[32m=== 生成完了 ===\x1b[0m\n");
  console.log("次のステップ:");
  console.log("  1. 生成されたファイルを確認");
  console.log("  2. pnpm db:generate でマイグレーションファイル生成");
  console.log("  3. pnpm db:push でDBに反映");
  console.log("");

  return true;
}

// 直接実行時の処理
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generate().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
