#!/usr/bin/env node
/**
 * setting-fields.json のテンプレートを生成するスクリプト
 */
import fs from "fs";
import { fileURLToPath } from "url";
import {
  getSettingFieldsPath,
  readSettingFields,
  writeSettingFields,
  SETTING_CONFIG_VERSION,
} from "./utils/config-reader.mjs";

/**
 * 空のテンプレート設定を作成
 */
function createEmptyConfig() {
  return {
    settingConfigVersion: SETTING_CONFIG_VERSION,
    fields: [],
  };
}

/**
 * サンプルフィールド付きのテンプレート設定を作成
 */
function createSampleConfig() {
  return {
    settingConfigVersion: SETTING_CONFIG_VERSION,
    fields: [
      {
        name: "siteTitle",
        label: "サイトタイトル",
        fieldType: "string",
        formInput: "textInput",
        required: false,
        defaultValue: "",
        description: "サイトのタイトルを設定します",
      },
      {
        name: "maintenanceMode",
        label: "メンテナンスモード",
        fieldType: "boolean",
        formInput: "switchInput",
        required: false,
        defaultValue: false,
        description: "メンテナンスモードを有効にするとサイトが一時停止します",
      },
    ],
  };
}

/**
 * init コマンドのメイン処理
 * @param {Object} options
 * @param {boolean} options.withSamples サンプルフィールドを含めるか
 * @param {boolean} options.force 既存ファイルを上書きするか
 */
export default async function init(options = {}) {
  const { withSamples = false, force = false } = options;
  const filePath = getSettingFieldsPath();

  // 既存ファイルのチェック
  const existing = readSettingFields();
  if (existing && !force) {
    console.log(`\x1b[33m既に設定ファイルが存在します: ${filePath}\x1b[0m`);
    console.log("上書きする場合は --force オプションを使用してください");
    return false;
  }

  // テンプレート作成
  const config = withSamples ? createSampleConfig() : createEmptyConfig();
  writeSettingFields(config);

  console.log(`\x1b[32m設定ファイルを作成しました: ${filePath}\x1b[0m`);
  console.log("");
  console.log("次のステップ:");
  console.log("  1. setting-fields.json を編集してフィールドを追加");
  console.log("  2. pnpm sc:generate で拡張ファイルを生成");
  console.log("  3. pnpm db:generate && pnpm db:migrate でマイグレーション");
  console.log("");
  console.log("フィールド定義の例:");
  console.log(`{
  "name": "siteTitle",
  "label": "サイトタイトル",
  "fieldType": "string",
  "formInput": "textInput",
  "required": false,
  "defaultValue": "",
  "description": "サイトのタイトル"
}`);

  return true;
}

// 直接実行時の処理
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {
    withSamples: args.includes("--samples"),
    force: args.includes("--force"),
  };
  init(options).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
