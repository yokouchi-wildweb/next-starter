// src/lib/dataMigration/import/parseCsv.ts

import "server-only";
import { parse } from "csv-parse/sync";

export type ParseCsvResult = {
  success: true;
  records: Record<string, unknown>[];
  headers: string[];
};

export type ParseCsvError = {
  success: false;
  error: string;
};

/**
 * BOM を除去
 */
function removeBom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

/**
 * 改行コードを正規化（CRLF/CR → LF）
 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * セル値を変換（仕様に従う）
 * - null: 空セル（クォートなし）→ null
 * - empty_string: "" → ""
 * - {{LF}} → \n
 */
function convertCellValue(value: string | null | undefined): unknown {
  // csv-parse は空セルを空文字列として返すが、
  // クォートなしの空セルとクォート付き空文字列を区別するのは難しい
  // ここでは空文字列はそのまま返し、アプリ側で処理する
  if (value === null || value === undefined) {
    return null;
  }

  // {{LF}} を実際の改行に変換
  const converted = value.replace(/\{\{LF\}\}/g, "\n");

  return converted;
}

/**
 * 型変換（フィールド値を適切な型に変換）
 */
export function convertFieldValue(value: unknown, fieldName: string): unknown {
  if (value === null || value === undefined || value === "") {
    // システムフィールドの空値は null として扱う
    if (["id", "createdAt", "updatedAt", "deletedAt"].includes(fieldName)) {
      return value === "" ? null : value;
    }
    return value === "" ? null : value;
  }

  if (typeof value !== "string") {
    return value;
  }

  // boolean 変換
  if (value === "true") return true;
  if (value === "false") return false;

  // 数値変換は行わない（Zod バリデーションに任せる）
  // 日付変換も行わない（文字列のまま、Zod で検証）

  return value;
}

/**
 * CSV をパース
 */
export function parseCsv(csvContent: string): ParseCsvResult | ParseCsvError {
  try {
    // BOM 除去と改行正規化
    const normalized = normalizeLineEndings(removeBom(csvContent));

    // csv-parse でパース（RFC 4180 準拠）
    const records = parse(normalized, {
      columns: true, // 最初の行をヘッダーとして使用
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: false, // 空白は保持
    }) as Record<string, string>[];

    if (records.length === 0) {
      // ヘッダーのみの場合
      const headerLine = normalized.split("\n")[0] || "";
      const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      return {
        success: true,
        records: [],
        headers,
      };
    }

    // ヘッダーを取得
    const headers = Object.keys(records[0] || {});

    // セル値を変換
    const convertedRecords = records.map((record) => {
      const converted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        const cellValue = convertCellValue(value);
        converted[key] = convertFieldValue(cellValue, key);
      }
      return converted;
    });

    return {
      success: true,
      records: convertedRecords,
      headers,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse CSV",
    };
  }
}
