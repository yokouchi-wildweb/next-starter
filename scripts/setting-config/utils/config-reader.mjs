#!/usr/bin/env node
/**
 * setting-fields.json の読み込みユーティリティ
 */
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * setting-fields.json のパスを取得
 */
export function getSettingFieldsPath() {
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  return path.join(rootDir, "src", "features", "core", "setting", "setting-fields.json");
}

/**
 * setting-fields.json を読み込む
 * @returns {Object|null} 設定オブジェクト。ファイルが存在しない場合は null
 */
export function readSettingFields() {
  const filePath = getSettingFieldsPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * setting-fields.json を書き込む
 * @param {Object} config 設定オブジェクト
 */
export function writeSettingFields(config) {
  const filePath = getSettingFieldsPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * フィールドが存在するかチェック
 * @returns {boolean} フィールドが1つ以上存在する場合 true
 */
export function hasExtendedFields() {
  const config = readSettingFields();
  return config?.fields?.length > 0;
}

/**
 * フィールド数を取得
 * @returns {number} フィールド数
 */
export function getFieldCount() {
  const config = readSettingFields();
  return config?.fields?.length ?? 0;
}

/**
 * 設定のバージョンを取得
 */
export const SETTING_CONFIG_VERSION = "1.0";
