// src/lib/dataMigration/export/generateCsv.ts

import "server-only";

/**
 * CSV 生成仕様:
 * - encoding: UTF-8 with BOM
 * - line_ending: LF
 * - delimiter: comma
 * - quote: double-quote (RFC 4180)
 * - null: empty cell (no quotes)
 * - empty_string: ""
 * - newline_in_text: {{LF}} placeholder
 */

const BOM = "\uFEFF";
const LF = "\n";
const NEWLINE_PLACEHOLDER = "{{LF}}";

/**
 * 値を CSV セル形式に変換
 */
function formatCellValue(value: unknown): string {
  // null/undefined は空セル
  if (value === null || value === undefined) {
    return "";
  }

  // boolean
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  // number
  if (typeof value === "number") {
    return String(value);
  }

  // Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  // array (belongsToMany など)
  if (Array.isArray(value)) {
    return value.join(",");
  }

  // object (JSON)
  if (typeof value === "object") {
    // JSON 内の " を ' に置換してからダブルクォートでラップ
    const jsonStr = JSON.stringify(value).replace(/"/g, "'");
    return `"${jsonStr}"`;
  }

  // string
  const strValue = String(value);

  // 空文字は ""
  if (strValue === "") {
    return '""';
  }

  // 改行を {{LF}} に置換
  const normalizedValue = strValue
    .replace(/\r\n/g, LF)
    .replace(/\r/g, LF)
    .replace(/\n/g, NEWLINE_PLACEHOLDER);

  // ダブルクォート、カンマ、改行プレースホルダーを含む場合はクォート
  if (normalizedValue.includes('"') || normalizedValue.includes(",") || normalizedValue.includes(NEWLINE_PLACEHOLDER)) {
    // ダブルクォートをエスケープ
    const escaped = normalizedValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return normalizedValue;
}

/**
 * レコードを CSV 行に変換
 */
function recordToRow(record: Record<string, unknown>, fields: string[]): string {
  return fields.map((field) => formatCellValue(record[field])).join(",");
}

export type GenerateCsvOptions = {
  /** エクスポートするフィールド名（順序通りに出力） */
  fields: string[];
  /** ヘッダー行を含めるか */
  includeHeader?: boolean;
};

/**
 * レコード配列から CSV 文字列を生成
 */
export function generateCsv(
  records: Record<string, unknown>[],
  options: GenerateCsvOptions
): string {
  const { fields, includeHeader = true } = options;

  const lines: string[] = [];

  // ヘッダー行
  if (includeHeader) {
    lines.push(fields.join(","));
  }

  // データ行
  for (const record of records) {
    lines.push(recordToRow(record, fields));
  }

  // BOM + LF 改行で結合
  return BOM + lines.join(LF);
}

/**
 * CSV 文字列を Buffer に変換
 */
export function csvToBuffer(csv: string): Buffer {
  return Buffer.from(csv, "utf-8");
}
