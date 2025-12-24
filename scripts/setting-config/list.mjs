#!/usr/bin/env node
/**
 * 設定項目の一覧を表示するスクリプト
 */
import { fileURLToPath } from "url";
import { readSettingFields, getSettingFieldsPath } from "./utils/config-reader.mjs";

/**
 * フィールドタイプの日本語表示
 */
const FIELD_TYPE_LABELS = {
  string: "文字列",
  integer: "整数",
  float: "小数",
  boolean: "真偽値",
  enum: "列挙型",
  date: "日付",
  time: "時刻",
  timestamp: "日時",
  "timestamp With Time Zone": "日時(TZ)",
  mediaUploader: "メディア",
};

/**
 * フォーム入力タイプの日本語表示
 */
const FORM_INPUT_LABELS = {
  textInput: "テキスト入力",
  textarea: "テキストエリア",
  numberInput: "数値入力",
  switchInput: "スイッチ",
  select: "セレクト",
  radio: "ラジオ",
  dateInput: "日付入力",
  datetimeInput: "日時入力",
  mediaUploader: "メディアアップローダー",
};

/**
 * 基本設定項目（固定）
 */
const BASE_FIELDS = [
  {
    name: "adminHeaderLogoImageUrl",
    label: "管理画面ロゴ（ライト）",
    fieldType: "mediaUploader",
    formInput: "mediaUploader",
    required: false,
  },
  {
    name: "adminHeaderLogoImageDarkUrl",
    label: "管理画面ロゴ（ダーク）",
    fieldType: "mediaUploader",
    formInput: "mediaUploader",
    required: false,
  },
  {
    name: "adminListPerPage",
    label: "一覧表示件数",
    fieldType: "integer",
    formInput: "numberInput",
    required: true,
  },
  {
    name: "adminFooterText",
    label: "フッターテキスト",
    fieldType: "string",
    formInput: "textInput",
    required: true,
  },
];

/**
 * フィールド情報をテーブル形式で表示
 * @param {Array} fields フィールド配列
 * @param {string} title セクションタイトル
 */
function printFieldsTable(fields, title) {
  console.log(`\n\x1b[36m${title}\x1b[0m`);
  console.log("─".repeat(80));

  if (fields.length === 0) {
    console.log("  (フィールドなし)");
    return;
  }

  // ヘッダー
  console.log(
    `  ${"名前".padEnd(25)} ${"ラベル".padEnd(20)} ${"型".padEnd(10)} ${"入力".padEnd(15)} ${"必須".padEnd(4)}`
  );
  console.log("  " + "─".repeat(76));

  // フィールド行
  for (const field of fields) {
    const name = field.name.padEnd(25);
    const label = (field.label || "-").slice(0, 18).padEnd(20);
    const fieldType = (FIELD_TYPE_LABELS[field.fieldType] || field.fieldType).padEnd(10);
    const formInput = (FORM_INPUT_LABELS[field.formInput] || field.formInput || "-").padEnd(15);
    const required = field.required ? "○" : "-";

    console.log(`  ${name} ${label} ${fieldType} ${formInput} ${required}`);
  }
}

/**
 * list コマンドのメイン処理
 * @param {Object} options
 * @param {boolean} options.extended 拡張フィールドのみ表示
 * @param {boolean} options.base 基本フィールドのみ表示
 * @param {boolean} options.json JSON形式で出力
 */
export default async function list(options = {}) {
  const { extended = false, base = false, json = false } = options;

  const config = readSettingFields();
  const extendedFields = config?.fields || [];

  // JSON出力モード
  if (json) {
    const output = {
      baseFields: base || (!extended && !base) ? BASE_FIELDS : [],
      extendedFields: extended || (!extended && !base) ? extendedFields : [],
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("\n\x1b[1m=== Setting ドメイン 設定項目一覧 ===\x1b[0m");

  // 設定ファイルの状態
  if (!config) {
    console.log(`\n\x1b[33m設定ファイルが見つかりません: ${getSettingFieldsPath()}\x1b[0m`);
    console.log("pnpm sc:init で初期化してください");
  } else {
    console.log(`\n設定ファイル: ${getSettingFieldsPath()}`);
    console.log(`バージョン: ${config.settingConfigVersion || "不明"}`);
  }

  // 基本フィールド
  if (!extended) {
    printFieldsTable(BASE_FIELDS, "基本設定項目（固定）");
  }

  // 拡張フィールド
  if (!base) {
    printFieldsTable(extendedFields, "拡張設定項目（カスタマイズ可能）");
  }

  // サマリー
  console.log("\n" + "─".repeat(80));
  console.log(`基本項目: ${BASE_FIELDS.length}件 / 拡張項目: ${extendedFields.length}件`);
  console.log(`合計: ${BASE_FIELDS.length + extendedFields.length}件`);
  console.log("");
}

// 直接実行時の処理
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {
    extended: args.includes("--extended"),
    base: args.includes("--base"),
    json: args.includes("--json"),
  };
  list(options).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
